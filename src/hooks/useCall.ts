import { useCallback } from 'react';
import { Device } from 'mediasoup-client';
import { useCallStore } from '../stores/call.js';
import { useVoiceStore } from '../stores/voice.js';
import { useAuthStore } from '../stores/auth.js';
import { usePresenceStore } from '../stores/presence.js';
import { useFriendStore } from '../stores/friend.js';
import { connectionManager } from '../services/connection-manager.js';
import { preferenceManager } from '../services/preference-manager.js';
import {
  CAMERA_PRESETS,
  SCREEN_PRESETS,
  getVideoQuality,
  getScreenQuality,
  setVideoQuality,
  setScreenQuality,
} from '../lib/media-presets.js';
import { startSpeakingDetection, switchAudioOutputDevice } from '../lib/media-utils.js';
import { showOsNotification } from '../services/notification-service.js';

let callEventQueue: Promise<void> = Promise.resolve();
let consumeQueue: Promise<void> = Promise.resolve();
let pendingCallProduceResolve: ((id: string) => void) | null = null;
let pendingCallProduceReject: ((err: Error) => void) | null = null;
let localSpeakingCleanup: (() => void) | null = null;
let remoteSpeakingCleanup: (() => void) | null = null;
let callAudioElement: HTMLAudioElement | null = null;
let cleanupTimeoutId: ReturnType<typeof setTimeout> | null = null;
const consumedProducerIds = new Set<string>();

export function handleCallWsEvent(event: string, data: unknown): void {
  // Handle call.produced immediately to avoid deadlock
  if (event === 'call.produced') {
    const d = data as Record<string, unknown>;
    pendingCallProduceResolve?.(d.producer_id as string);
    pendingCallProduceResolve = null;
    pendingCallProduceReject = null;
    return;
  }

  // Reject pending produce on error to avoid deadlock — then let it flow into queue for cleanup
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

async function processCallEvent(event: string, data: unknown): Promise<void> {
  const d = data as Record<string, unknown>;
  const centralWs = connectionManager.getCentralWs();
  if (!centralWs) {
    return;
  }

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
        // Originating session — store the real callId
        useCallStore.setState({ callId: d.call_id as string });
      } else if (store.callState === 'idle' && d.peer) {
        // Another session started this call — show "call on another device"
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
      // Guard: skip if answered on another device
      if (useCallStore.getState().answeredElsewhere) {
        break;
      }
      // Guard: skip if we already loaded a device for this call
      if (useCallStore.getState().device) {
        break;
      }
      useCallStore.getState().setConnecting();
      const device = new Device();
      await device.load({
        routerRtpCapabilities: d.rtpCapabilities as Parameters<typeof device.load>[0]['routerRtpCapabilities'],
      });
      useCallStore.getState().setDevice(device);

      // Send capabilities immediately so the server can create consumers
      // even if audio produce fails (e.g. no microphone)
      centralWs.send('call.capabilities', {
        call_id: d.call_id,
        rtp_capabilities: device.rtpCapabilities,
      });
      break;
    }

    case 'call.transport_created': {
      // Guard: skip if answered on another device
      if (useCallStore.getState().answeredElsewhere) {
        break;
      }
      // Guard: skip if we already created transports for this call
      if (useCallStore.getState().sendTransport) {
        break;
      }
      const device = useCallStore.getState().device;
      if (!device) { break; }

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
        sendTransport.on('connectionstatechange', () => {});
        sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback) => {
          const idPromise = new Promise<string>((resolve, reject) => {
            pendingCallProduceResolve = resolve;
            pendingCallProduceReject = reject;
            // Safety timeout to prevent permanent deadlock
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

        // Auto-produce audio (gracefully handle missing devices)
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

            // Speaking detection
            localSpeakingCleanup = startSpeakingDetection(stream, (speaking) => {
              useCallStore.getState().setLocalSpeaking(speaking);
            });
          } catch (produceErr) {
            console.warn('[call] produce rejected (permission denied?):', produceErr);
          }
        } catch (err) {
          console.warn('[call] audio setup failed (no microphone?):', err);
          // Continue without audio — call can still work for receiving/video/screen
        }

        // Auto-produce video if the call was initiated with video
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
        recvTransport.on('connectionstatechange', () => {});
        useCallStore.getState().setRecvTransport(recvTransport);
      }

      useCallStore.getState().setActive();
      break;
    }

    case 'call.new_consumer': {
      // Guard: skip if answered on another device
      if (useCallStore.getState().answeredElsewhere) {
        break;
      }
      const recvTransport = useCallStore.getState().recvTransport;
      if (!recvTransport) {
        break;
      }

      const producerId = d.producer_id as string;

      // Skip duplicate consumers for the same producer
      if (consumedProducerIds.has(producerId)) {
        break;
      }
      consumedProducerIds.add(producerId);

      // Serialize consume operations to prevent SDP conflicts
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

          // Wait for transport to be connected before resuming so the
          // server-side keyframe isn't dropped during ICE/DTLS handshake
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

            // Play audio through hidden element
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
              // Replace main call audio element
              if (callAudioElement) callAudioElement.remove();
              callAudioElement = audio;

              // Remote speaking detection
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

            // Monitor track state changes
            consumer.track.addEventListener('ended', () => {});
            consumer.track.addEventListener('mute', () => {});
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

      // Find consumer with this producerId
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

      // Ignore if this call was already cleaned up (e.g. we initiated the hangup)
      if (currentCallId !== endedCallId) {
        break;
      }

      useCallStore.getState().setEnded(reason);

      // Cancel any existing cleanup timer from a previous call
      if (cleanupTimeoutId) {
        clearTimeout(cleanupTimeoutId);
      }

      // Clean up after a brief display
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
      // If this session already loaded a device (is the active call participant),
      // ignore — this came from a duplicate WS connection in the same tab
      if (aeState.device || aeState.callState === 'connecting' || aeState.callState === 'active') {
        break;
      }
      useCallStore.getState().setAnsweredElsewhere();
      break;
    }

    case 'call.transferred': {
      // Call was transferred to another session — clean up media but stay in call context
      // so user sees "Call active on another device" with a transfer-back button
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

      // Close media resources but keep call metadata (callId, peer, etc.)
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

    case 'call.reconnected': {
      // Peer reconnected — state update will follow
      break;
    }
  }
}

function cleanupCall(): void {
  // Cancel any pending cleanup timer
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
  // Remove any extra audio elements (screen-audio etc)
  document.querySelectorAll('audio[data-call-audio]').forEach((el) => el.remove());
  pendingCallProduceResolve = null;
  pendingCallProduceReject = null;
  consumedProducerIds.clear();
  callEventQueue = Promise.resolve();
  consumeQueue = Promise.resolve();
  useCallStore.getState().cleanup();
}

function sendMuteUpdate(): void {
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

export function useCall() {
  const callState = useCallStore((s) => s.callState);
  const callId = useCallStore((s) => s.callId);
  const peer = useCallStore((s) => s.peer);
  const mediaTypes = useCallStore((s) => s.mediaTypes);
  const isInitiator = useCallStore((s) => s.isInitiator);
  const endReason = useCallStore((s) => s.endReason);
  const startedAt = useCallStore((s) => s.startedAt);
  const selfMuted = useCallStore((s) => s.selfMuted);
  const selfDeafened = useCallStore((s) => s.selfDeafened);
  const videoEnabled = useCallStore((s) => s.videoEnabled);
  const screenSharing = useCallStore((s) => s.screenSharing);
  const peerMuted = useCallStore((s) => s.peerMuted);
  const peerDeafened = useCallStore((s) => s.peerDeafened);
  const peerVideoEnabled = useCallStore((s) => s.peerVideoEnabled);
  const peerScreenSharing = useCallStore((s) => s.peerScreenSharing);
  const localSpeaking = useCallStore((s) => s.localSpeaking);
  const remoteSpeaking = useCallStore((s) => s.remoteSpeaking);
  const localVideoStream = useCallStore((s) => s.localVideoStream);
  const localScreenStream = useCallStore((s) => s.localScreenStream);
  const remoteVideoStream = useCallStore((s) => s.remoteVideoStream);
  const remoteScreenStream = useCallStore((s) => s.remoteScreenStream);

  const startCall = useCallback((targetUserId: string, mediaTypes: ('audio' | 'video')[]) => {
    const centralWs = connectionManager.getCentralWs();
    if (!centralWs) {
      return;
    }

    // If we're showing the "ended" screen, clean up immediately so we can start a new call
    if (useCallStore.getState().callState === 'ended') {
      cleanupCall();
    }

    // Already in a call — prevent
    const currentState = useCallStore.getState().callState;
    if (currentState !== 'idle') {
      return;
    }

    // Already in a voice channel — leave voice first
    const { currentChannelId, currentServerId } = useVoiceStore.getState();
    if (currentChannelId && currentServerId) {
      const ws = connectionManager.getMainWs(currentServerId);
      ws?.voiceLeave(currentChannelId);
      useVoiceStore.getState().cleanup();
    }

    // Look up friend info for optimistic UI
    const friend = useFriendStore.getState().friends.get(targetUserId);
    if (friend) {
      useCallStore.getState().setOutgoingCall(
        '', // callId will come from ringing event
        {
          user_id: friend.user_id,
          username: friend.username,
          discriminator: friend.discriminator ?? '0000',
          display_name: friend.display_name ?? null,
          avatar_url: friend.avatar_url ?? null,
        },
        mediaTypes,
      );
    }

    centralWs.send('call.invite', {
      target_user_id: targetUserId,
      media_types: mediaTypes,
    });

    // Reset event queue
    callEventQueue = Promise.resolve();
  }, []);

  const answerCall = useCallback((withVideo?: boolean) => {
    const { callId, callState } = useCallStore.getState();
    if (!callId) {
      return;
    }
    const centralWs = connectionManager.getCentralWs();
    if (!centralWs) {
      return;
    }

    // Override mediaTypes based on answerer's choice
    if (withVideo) {
      useCallStore.setState({ mediaTypes: ['audio', 'video'] });
    } else {
      useCallStore.setState({ mediaTypes: ['audio'] });
    }

    centralWs.send('call.answer', { call_id: callId });
  }, []);

  const rejectCall = useCallback(() => {
    const { callId } = useCallStore.getState();
    if (!callId) return;
    const centralWs = connectionManager.getCentralWs();
    if (!centralWs) return;

    centralWs.send('call.reject', { call_id: callId });
    cleanupCall();
  }, []);

  const endCall = useCallback(() => {
    const { callId } = useCallStore.getState();
    if (!callId) return;
    const centralWs = connectionManager.getCentralWs();
    if (!centralWs) return;

    centralWs.send('call.end', { call_id: callId });
    cleanupCall();
  }, []);

  const toggleMute = useCallback(() => {
    useCallStore.getState().toggleMute();
    const { selfMuted: muted } = useCallStore.getState();

    // Pause/resume audio producer
    const audioProducer = useCallStore.getState().producers.get('audio');
    if (audioProducer) {
      if (muted) audioProducer.pause();
      else audioProducer.resume();
    }

    sendMuteUpdate();
  }, []);

  const toggleDeafen = useCallback(() => {
    useCallStore.getState().toggleDeafen();
    sendMuteUpdate();
  }, []);

  const toggleVideo = useCallback(async () => {
    const { sendTransport, producers, callId } = useCallStore.getState();
    const centralWs = connectionManager.getCentralWs();

    if (producers.has('video')) {
      // Stop video
      const producer = producers.get('video')!;
      if (centralWs && callId) {
        centralWs.send('call.produce_stop', {
          call_id: callId,
          producer_id: producer.id,
        });
      }
      useCallStore.getState().removeProducer('video');
      useCallStore.getState().setLocalVideoStream(null);
      useCallStore.getState().toggleVideo();
      sendMuteUpdate();
    } else if (sendTransport && centralWs) {
      // Start video
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
        console.error('[call] video setup failed:', err);
      }
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const { sendTransport, producers, callId } = useCallStore.getState();
    const centralWs = connectionManager.getCentralWs();

    if (producers.has('screen')) {
      // Stop screen share
      const screenProducer = producers.get('screen')!;
      if (centralWs && callId) {
        centralWs.send('call.produce_stop', {
          call_id: callId,
          producer_id: screenProducer.id,
        });
      }
      useCallStore.getState().removeProducer('screen');

      // Also stop screen audio if active
      const screenAudioProducer = producers.get('screen-audio');
      if (screenAudioProducer) {
        if (centralWs && callId) {
          centralWs.send('call.produce_stop', {
            call_id: callId,
            producer_id: screenAudioProducer.id,
          });
        }
        useCallStore.getState().removeProducer('screen-audio');
      }

      useCallStore.getState().setLocalScreenStream(null);
      useCallStore.getState().toggleScreenSharing();
      sendMuteUpdate();
    } else if (sendTransport && centralWs) {
      try {
        const screenPreset = SCREEN_PRESETS[getScreenQuality()];
        const stream = await navigator.mediaDevices.getDisplayMedia(screenPreset.constraints);
        const screenTrack = stream.getVideoTracks()[0]!;
        screenTrack.contentHint = screenPreset.contentHint;

        // Prefer VP9 for screen content (better compression, sharper text)
        const device = useCallStore.getState().device;
        const vp9Codec = device?.rtpCapabilities.codecs?.find(
          (c) => c.mimeType.toLowerCase() === 'video/vp9',
        );

        const maxKbps = Math.round(screenPreset.encodings[0]!.maxBitrate! / 1000);
        const producer = await sendTransport.produce({
          track: screenTrack,
          encodings: screenPreset.encodings.map((e) => ({ ...e, priority: 'high' as const, networkPriority: 'high' as const })),
          codecOptions: {
            videoGoogleStartBitrate: Math.round(maxKbps * 0.5),
            videoGoogleMinBitrate: Math.round(maxKbps * 0.25),
            videoGoogleMaxBitrate: maxKbps,
          },
          codec: vp9Codec,
          appData: { source: 'screen' },
        });
        useCallStore.getState().setProducer('screen', producer);
        useCallStore.getState().setLocalScreenStream(new MediaStream([screenTrack]));
        useCallStore.getState().toggleScreenSharing();
        sendMuteUpdate();

        // Produce screen audio if available (tab/app audio)
        const screenAudioTrack = stream.getAudioTracks()[0];
        if (screenAudioTrack) {
          const audioProducer = await sendTransport.produce({
            track: screenAudioTrack,
            appData: { source: 'screen-audio' },
          });
          useCallStore.getState().setProducer('screen-audio', audioProducer);
        }

        // Auto-cleanup when user clicks browser's "Stop sharing"
        screenTrack.addEventListener('ended', () => {
          const curState = useCallStore.getState();
          const curCallId = curState.callId;
          const curWs = connectionManager.getCentralWs();
          const screenProd = curState.producers.get('screen');
          if (curWs && screenProd?.id && curCallId) {
            curWs.send('call.produce_stop', {
              call_id: curCallId,
              producer_id: screenProd.id,
            });
          }
          useCallStore.getState().removeProducer('screen');

          // Also stop screen audio
          const screenAudioProd = useCallStore.getState().producers.get('screen-audio');
          if (screenAudioProd) {
            if (curWs && screenAudioProd.id && curCallId) {
              curWs.send('call.produce_stop', {
                call_id: curCallId,
                producer_id: screenAudioProd.id,
              });
            }
            useCallStore.getState().removeProducer('screen-audio');
          }

          useCallStore.getState().setLocalScreenStream(null);
          if (curState.screenSharing) useCallStore.getState().toggleScreenSharing();
          sendMuteUpdate();
        });
      } catch (err) {
        // User cancelled the display picker
        console.error('[call] screen share failed:', err);
      }
    }
  }, []);

  const answeredElsewhere = useCallStore((s) => s.answeredElsewhere);

  const transferCall = useCallback(() => {
    const { callId } = useCallStore.getState();
    if (!callId) return;
    const centralWs = connectionManager.getCentralWs();
    if (!centralWs) return;

    // Reset answeredElsewhere so we can receive media events on this session
    useCallStore.setState({ answeredElsewhere: false, device: null, sendTransport: null, recvTransport: null });
    consumedProducerIds.clear();

    // Send answer again — server treats this as a transfer
    centralWs.send('call.answer', { call_id: callId });
  }, []);

  const dismissCall = useCallback(() => {
    cleanupCall();
  }, []);

  const switchAudioDevice = useCallback(async (deviceId: string) => {
    const audioProducer = useCallStore.getState().producers.get('audio');
    if (!audioProducer) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
      });
      const newTrack = stream.getAudioTracks()[0]!;
      await audioProducer.replaceTrack({ track: newTrack });
      useCallStore.getState().setLocalAudioStream(stream);
      // Restart speaking detection
      localSpeakingCleanup?.();
      localSpeakingCleanup = startSpeakingDetection(stream, (speaking) => {
        useCallStore.getState().setLocalSpeaking(speaking);
      });
    } catch (err) {
      console.error('[call] failed to switch audio device:', err);
    }
  }, []);

  const switchAudioOutput = useCallback(async (deviceId: string) => {
    preferenceManager.setDevice('audio-output', deviceId);
    const elements: (HTMLAudioElement | HTMLVideoElement)[] = [];
    if (callAudioElement) elements.push(callAudioElement);
    const extras = document.querySelectorAll<HTMLAudioElement>('audio[data-call-audio]');
    for (const el of extras) elements.push(el);
    await switchAudioOutputDevice(elements, deviceId);
  }, []);

  const switchVideoDevice = useCallback(async (deviceId: string) => {
    const videoProducer = useCallStore.getState().producers.get('video');
    if (!videoProducer) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { ...CAMERA_PRESETS[getVideoQuality()].constraints, deviceId: { exact: deviceId } },
      });
      const newTrack = stream.getVideoTracks()[0]!;
      await videoProducer.replaceTrack({ track: newTrack });
      useCallStore.getState().setLocalVideoStream(new MediaStream([newTrack]));
    } catch (err) {
      console.error('[call] failed to switch video device:', err);
    }
  }, []);

  return {
    callState,
    callId,
    peer,
    mediaTypes,
    isInitiator,
    endReason,
    startedAt,
    selfMuted,
    selfDeafened,
    videoEnabled,
    screenSharing,
    peerMuted,
    peerDeafened,
    peerVideoEnabled,
    peerScreenSharing,
    localSpeaking,
    remoteSpeaking,
    localVideoStream,
    localScreenStream,
    remoteVideoStream,
    remoteScreenStream,
    isInCall: callState !== 'idle',
    answeredElsewhere,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    transferCall,
    dismissCall,
    toggleMute,
    toggleDeafen,
    toggleVideo,
    toggleScreenShare,
    switchAudioDevice,
    switchAudioOutput,
    switchVideoDevice,
    setVideoQuality,
    setScreenQuality,
  };
}
