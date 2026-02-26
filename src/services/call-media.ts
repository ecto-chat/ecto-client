import { Device } from 'mediasoup-client';
import { useCallStore } from '../stores/call.js';
import { connectionManager } from './connection-manager.js';
import { preferenceManager } from './preference-manager.js';
import { CAMERA_PRESETS, getVideoQuality, getScreenQuality } from '../lib/media-presets.js';
import { startSpeakingDetection } from '../lib/media-utils.js';
import { showOsNotification } from './notification-service.js';

// ── Module-level mutable state ──

let callEventQueue: Promise<void> = Promise.resolve();
let consumeQueue: Promise<void> = Promise.resolve();
let pendingCallProduceResolve: ((id: string) => void) | null = null;
let pendingCallProduceReject: ((err: Error) => void) | null = null;
let localSpeakingCleanup: (() => void) | null = null;
let remoteSpeakingCleanup: (() => void) | null = null;
let callAudioElement: HTMLAudioElement | null = null;
let cleanupTimeoutId: ReturnType<typeof setTimeout> | null = null;
const consumedProducerIds = new Set<string>();

// ── Public API ──

export function handleCallWsEvent(event: string, data: unknown): void {
  // Handle call.produced immediately to avoid deadlock
  if (event === 'call.produced') {
    const d = data as Record<string, unknown>;
    pendingCallProduceResolve?.(d.producer_id as string);
    pendingCallProduceResolve = null;
    pendingCallProduceReject = null;
    return;
  }

  if (event === 'call.error' && pendingCallProduceReject) {
    const d = data as Record<string, unknown>;
    pendingCallProduceReject(new Error(`call.error: ${d.code} ${d.message}`));
    pendingCallProduceResolve = null;
    pendingCallProduceReject = null;
  }

  callEventQueue = callEventQueue.then(() => processCallEvent(event, data)).catch((err) => {
    console.error('[call] Event processing error:', event, err);
  });
}

export function cleanupCall(): void {
  if (cleanupTimeoutId) {
    clearTimeout(cleanupTimeoutId);
    cleanupTimeoutId = null;
  }
  localSpeakingCleanup?.();
  localSpeakingCleanup = null;
  remoteSpeakingCleanup?.();
  remoteSpeakingCleanup = null;
  if (callAudioElement) {
    callAudioElement.remove();
    callAudioElement = null;
  }
  document.querySelectorAll('audio[data-call-audio]').forEach((el) => el.remove());
  pendingCallProduceResolve = null;
  pendingCallProduceReject = null;
  consumedProducerIds.clear();
  callEventQueue = Promise.resolve();
  consumeQueue = Promise.resolve();
  useCallStore.getState().cleanup();
}

export function sendMuteUpdate(): void {
  const { selfMuted, selfDeafened, videoEnabled, screenSharing, callId } = useCallStore.getState();
  const centralWs = connectionManager.getCentralWs();
  if (centralWs && callId) {
    centralWs.send('call.mute_update', {
      call_id: callId,
      self_mute: selfMuted,
      self_deaf: selfDeafened,
      video_enabled: videoEnabled,
      screen_sharing: screenSharing,
    });
  }
}

export function resetConsumedProducerIds(): void {
  consumedProducerIds.clear();
}

export function getCallAudioElement(): HTMLAudioElement | null {
  return callAudioElement;
}

export function resetCallEventQueue(): void {
  callEventQueue = Promise.resolve();
}

// ── Event processing ──

async function processCallEvent(event: string, data: unknown): Promise<void> {
  const d = data as Record<string, unknown>;
  const centralWs = connectionManager.getCentralWs();
  if (!centralWs) return;

  switch (event) {
    case 'call.invite': {
      useCallStore.getState().setIncomingCall(
        d.call_id as string,
        d.caller as import('ecto-shared').CallPeerInfo,
        d.media_types as ('audio' | 'video')[],
      );
      const caller = d.caller as { username?: string; display_name?: string | null } | undefined;
      showOsNotification(
        'Incoming Call',
        `${caller?.display_name ?? caller?.username ?? 'Someone'} is calling you`,
        { type: 'call', callId: d.call_id as string },
      );
      break;
    }

    case 'call.ringing': {
      const store = useCallStore.getState();
      if (store.callState === 'outgoing_ringing' && !store.callId) {
        useCallStore.setState({ callId: d.call_id as string });
      } else if (store.callState === 'idle' && d.peer) {
        useCallStore.getState().setOutgoingCall(
          d.call_id as string,
          d.peer as import('ecto-shared').CallPeerInfo,
          (d.media_types as ('audio' | 'video')[]) ?? ['audio'],
        );
        useCallStore.getState().setAnsweredElsewhere();
      }
      break;
    }

    case 'call.router_capabilities': {
      if (useCallStore.getState().answeredElsewhere) break;
      if (useCallStore.getState().device) break;
      useCallStore.getState().setConnecting();
      const device = new Device();
      await device.load({
        routerRtpCapabilities: d.rtpCapabilities as Parameters<typeof device.load>[0]['routerRtpCapabilities'],
      });
      useCallStore.getState().setDevice(device);
      centralWs.send('call.capabilities', {
        call_id: d.call_id,
        rtp_capabilities: device.rtpCapabilities,
      });
      break;
    }

    case 'call.transport_created': {
      if (useCallStore.getState().answeredElsewhere) break;
      if (useCallStore.getState().sendTransport) break;
      const device = useCallStore.getState().device;
      if (!device) break;

      const callId = d.call_id as string;
      const sendParams = d.sendTransport as Record<string, unknown>;
      const recvParams = d.recvTransport as Record<string, unknown>;
      if (sendParams) {
        const sendTransport = device.createSendTransport(
          sendParams as Parameters<typeof device.createSendTransport>[0],
        );
        sendTransport.on('connect', ({ dtlsParameters }, callback) => {
          centralWs.send('call.connect_transport', {
            call_id: callId,
            transport_id: sendTransport.id,
            dtls_parameters: dtlsParameters,
          });
          callback();
        });
        sendTransport.on('connectionstatechange', (state) => {
          if (state === 'failed' || state === 'disconnected') {
            console.warn('[call] send transport', state);
          }
        });
        sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback) => {
          const idPromise = new Promise<string>((resolve, reject) => {
            pendingCallProduceResolve = resolve;
            pendingCallProduceReject = reject;
            setTimeout(() => {
              if (pendingCallProduceResolve === resolve) {
                reject(new Error('call.produce timeout'));
                pendingCallProduceResolve = null;
                pendingCallProduceReject = null;
              }
            }, 5000);
          });
          centralWs.send('call.produce', {
            call_id: callId,
            transport_id: sendTransport.id,
            kind,
            rtp_parameters: rtpParameters,
            rtp_capabilities: device.rtpCapabilities,
            app_data: appData,
          });
          const id = await idPromise;
          callback({ id });
        });
        useCallStore.getState().setSendTransport(sendTransport);

        try {
          const savedAudioDevice = preferenceManager.getDevice('audio-input', '');
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: savedAudioDevice ? { deviceId: { ideal: savedAudioDevice } } : true,
          });
          const audioTrack = stream.getAudioTracks()[0]!;
          try {
            const producer = await sendTransport.produce({ track: audioTrack, appData: { source: 'mic' } });
            useCallStore.getState().setProducer('audio', producer);
            useCallStore.getState().setLocalAudioStream(stream);
            localSpeakingCleanup = startSpeakingDetection(stream, (speaking) => {
              useCallStore.getState().setLocalSpeaking(speaking);
            });
          } catch (produceErr) {
            console.warn('[call] produce rejected (permission denied?):', produceErr);
          }
        } catch (err) {
          console.warn('[call] audio setup failed (no microphone?):', err);
        }

        if (useCallStore.getState().mediaTypes.includes('video')) {
          try {
            const savedVideoDevice = preferenceManager.getDevice('video-input', '');
            const preset = CAMERA_PRESETS[getVideoQuality()];
            const stream = await navigator.mediaDevices.getUserMedia({
              video: {
                ...preset.constraints,
                ...(savedVideoDevice ? { deviceId: { ideal: savedVideoDevice } } : {}),
              },
            });
            const videoTrack = stream.getVideoTracks()[0]!;
            const camMaxKbps = Math.round(preset.encodings[0]!.maxBitrate! / 1000);
            const producer = await sendTransport.produce({
              track: videoTrack,
              encodings: preset.encodings,
              codecOptions: {
                videoGoogleStartBitrate: Math.round(camMaxKbps * 0.5),
                videoGoogleMinBitrate: Math.round(camMaxKbps * 0.25),
                videoGoogleMaxBitrate: camMaxKbps,
              },
              appData: { source: 'camera' },
            });
            useCallStore.getState().setProducer('video', producer);
            useCallStore.getState().setLocalVideoStream(new MediaStream([videoTrack]));
            useCallStore.getState().toggleVideo();
            sendMuteUpdate();
          } catch (err) {
            console.warn('[call] auto video setup failed (no camera?):', err);
          }
        }
      }

      if (recvParams) {
        const recvTransport = device.createRecvTransport(
          recvParams as Parameters<typeof device.createRecvTransport>[0],
        );
        recvTransport.on('connect', ({ dtlsParameters }, callback) => {
          centralWs.send('call.connect_transport', {
            call_id: callId,
            transport_id: recvTransport.id,
            dtls_parameters: dtlsParameters,
          });
          callback();
        });
        recvTransport.on('connectionstatechange', (state) => {
          if (state === 'failed' || state === 'disconnected') {
            console.warn('[call] recv transport', state);
          }
        });
        useCallStore.getState().setRecvTransport(recvTransport);
      }

      useCallStore.getState().setActive();
      break;
    }

    case 'call.new_consumer': {
      if (useCallStore.getState().answeredElsewhere) break;
      const recvTransport = useCallStore.getState().recvTransport;
      if (!recvTransport) break;

      const producerId = d.producer_id as string;
      if (consumedProducerIds.has(producerId)) break;
      consumedProducerIds.add(producerId);

      const consumeData = { ...d };
      consumeQueue = consumeQueue.then(async () => {
        try {
          const consumer = await recvTransport.consume({
            id: consumeData.consumer_id as string,
            producerId: consumeData.producer_id as string,
            kind: consumeData.kind as 'audio' | 'video',
            rtpParameters: consumeData.rtp_parameters as Parameters<typeof recvTransport.consume>[0]['rtpParameters'],
          });

          useCallStore.getState().setConsumer(consumer.id, consumer);

          const sendResume = () => {
            centralWs.send('call.consumer_resume', {
              call_id: consumeData.call_id,
              consumer_id: consumer.id,
            });
          };
          if (recvTransport.connectionState === 'connected') {
            sendResume();
          } else {
            const onState = (state: string) => {
              if (state === 'connected') {
                sendResume();
                recvTransport.removeListener('connectionstatechange', onState);
              }
            };
            recvTransport.on('connectionstatechange', onState);
          }

          const appData = consumeData.app_data as Record<string, unknown> | undefined;
          const source = appData?.source as string | undefined;

          if (consumer.kind === 'audio') {
            const audioStream = new MediaStream([consumer.track]);
            if (source !== 'screen-audio') {
              useCallStore.getState().setRemoteAudioStream(audioStream);
            }

            const audio = document.createElement('audio');
            audio.srcObject = audioStream;
            audio.autoplay = true;
            audio.dataset['callAudio'] = 'true';
            const savedOutput = preferenceManager.getDevice('audio-output', '');
            if (savedOutput && 'setSinkId' in audio) {
              (audio as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(savedOutput).catch(() => {});
            }
            document.body.appendChild(audio);

            if (source !== 'screen-audio') {
              if (callAudioElement) callAudioElement.remove();
              callAudioElement = audio;
              remoteSpeakingCleanup = startSpeakingDetection(audioStream, (speaking) => {
                useCallStore.getState().setRemoteSpeaking(speaking);
              });
            }
          } else if (consumer.kind === 'video') {
            const stream = new MediaStream([consumer.track]);
            if (source === 'screen') {
              useCallStore.getState().setRemoteScreenStream(stream);
            } else {
              useCallStore.getState().setRemoteVideoStream(stream);
            }

            consumer.track.addEventListener('ended', () => { console.warn('[call] remote track ended:', consumer.id); });
            consumer.track.addEventListener('mute', () => { console.warn('[call] remote track muted:', consumer.id); });
            consumer.track.addEventListener('unmute', () => {});
          }
        } catch {
          consumedProducerIds.delete(producerId);
        }
      });
      break;
    }

    case 'call.producer_closed': {
      const store = useCallStore.getState();
      const producerId = d.producer_id as string;
      const appData = d.app_data as Record<string, unknown> | undefined;
      const source = appData?.source as string | undefined;

      for (const [consumerId, consumer] of store.consumers) {
        if (consumer.producerId === producerId) {
          useCallStore.getState().removeConsumer(consumerId);
          if (consumer.kind === 'video') {
            if (source === 'screen') {
              useCallStore.getState().setRemoteScreenStream(null);
            } else {
              useCallStore.getState().setRemoteVideoStream(null);
            }
          }
          break;
        }
      }
      break;
    }

    case 'call.state_update': {
      useCallStore.getState().setPeerState(
        d.self_mute as boolean,
        d.self_deaf as boolean,
        d.video_enabled as boolean,
        (d.screen_sharing as boolean | undefined) ?? false,
      );
      break;
    }

    case 'call.ended': {
      const reason = d.reason as import('ecto-shared').CallEndReason;
      const endedCallId = d.call_id as string;
      const currentCallId = useCallStore.getState().callId;
      if (currentCallId !== endedCallId) break;

      useCallStore.getState().setEnded(reason);
      if (cleanupTimeoutId) clearTimeout(cleanupTimeoutId);
      cleanupTimeoutId = setTimeout(() => {
        cleanupTimeoutId = null;
        const current = useCallStore.getState();
        if (current.callId === endedCallId && current.callState === 'ended') {
          cleanupCall();
        }
      }, 3000);
      break;
    }

    case 'call.answered_elsewhere': {
      const aeState = useCallStore.getState();
      if (aeState.device || aeState.callState === 'connecting' || aeState.callState === 'active') break;
      useCallStore.getState().setAnsweredElsewhere();
      break;
    }

    case 'call.transferred': {
      localSpeakingCleanup?.();
      localSpeakingCleanup = null;
      remoteSpeakingCleanup?.();
      remoteSpeakingCleanup = null;
      if (callAudioElement) { callAudioElement.remove(); callAudioElement = null; }
      document.querySelectorAll('audio[data-call-audio]').forEach((el) => el.remove());
      pendingCallProduceResolve = null;
      pendingCallProduceReject = null;
      consumedProducerIds.clear();
      consumeQueue = Promise.resolve();

      const trState = useCallStore.getState();
      trState.sendTransport?.close();
      trState.recvTransport?.close();
      for (const producer of trState.producers.values()) producer.close();
      for (const consumer of trState.consumers.values()) consumer.close();
      trState.localAudioStream?.getTracks().forEach((t) => t.stop());
      trState.localVideoStream?.getTracks().forEach((t) => t.stop());
      trState.localScreenStream?.getTracks().forEach((t) => t.stop());

      useCallStore.setState({
        device: null,
        sendTransport: null,
        recvTransport: null,
        producers: new Map(),
        consumers: new Map(),
        localAudioStream: null,
        localVideoStream: null,
        localScreenStream: null,
        remoteAudioStream: null,
        remoteVideoStream: null,
        remoteScreenStream: null,
        localSpeaking: false,
        remoteSpeaking: false,
        answeredElsewhere: true,
      });
      break;
    }

    case 'call.reconnected':
      break;
  }
}
