import { useCallback, useEffect, useRef } from 'react';
import { Device } from 'mediasoup-client';
import { useCallStore } from '../stores/call.js';
import { useAuthStore } from '../stores/auth.js';
import { usePresenceStore } from '../stores/presence.js';
import { useFriendStore } from '../stores/friend.js';
import { connectionManager } from '../services/connection-manager.js';
import {
  CAMERA_PRESETS,
  SCREEN_PRESETS,
  getVideoQuality,
  getScreenQuality,
  setVideoQuality,
  setScreenQuality,
} from '../lib/media-presets.js';

let callEventQueue: Promise<void> = Promise.resolve();
let consumeQueue: Promise<void> = Promise.resolve();
let pendingCallProduceResolve: ((id: string) => void) | null = null;
let localSpeakingCleanup: (() => void) | null = null;
let remoteSpeakingCleanup: (() => void) | null = null;
let callAudioElement: HTMLAudioElement | null = null;
const consumedProducerIds = new Set<string>();

function startSpeakingDetection(stream: MediaStream, onSpeaking: (speaking: boolean) => void): () => void {
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.4;
  source.connect(analyser);

  const data = new Uint8Array(analyser.frequencyBinCount);
  let wasSpeaking = false;
  const THRESHOLD = 15;

  const interval = setInterval(() => {
    analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i]!;
    const avg = sum / data.length;
    const isSpeaking = avg > THRESHOLD;

    if (isSpeaking !== wasSpeaking) {
      wasSpeaking = isSpeaking;
      onSpeaking(isSpeaking);
    }
  }, 100);

  return () => {
    clearInterval(interval);
    source.disconnect();
    audioCtx.close().catch(() => {});
  };
}

export function handleCallWsEvent(event: string, data: unknown): void {
  // Handle call.produced immediately to avoid deadlock
  if (event === 'call.produced') {
    const d = data as Record<string, unknown>;
    pendingCallProduceResolve?.(d.producer_id as string);
    pendingCallProduceResolve = null;
    return;
  }

  callEventQueue = callEventQueue.then(() => processCallEvent(event, data)).catch((err) => {
    console.error('[call] event handler error:', event, err);
  });
}

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
      break;
    }

    case 'call.ringing': {
      // Caller received confirmation callee is ringing — store the real callId
      const store = useCallStore.getState();
      if (store.callState === 'outgoing_ringing' && !store.callId) {
        useCallStore.setState({ callId: d.call_id as string });
      }
      break;
    }

    case 'call.router_capabilities': {
      // Guard: skip if we already loaded a device for this call
      if (useCallStore.getState().device) {
        console.log('[call:debug] router_capabilities SKIPPED (device already loaded)');
        break;
      }
      console.log('[call:debug] router_capabilities received, loading device...');
      useCallStore.getState().setConnecting();
      const device = new Device();
      await device.load({
        routerRtpCapabilities: d.rtpCapabilities as Parameters<typeof device.load>[0]['routerRtpCapabilities'],
      });
      const videoCodecs = device.rtpCapabilities.codecs?.filter((c) => c.kind === 'video') ?? [];
      console.log('[call:debug] device loaded, video codecs:', videoCodecs.map((c) => `${c.mimeType} ${JSON.stringify(c.parameters)}`));
      useCallStore.getState().setDevice(device);

      // Send capabilities immediately so the server can create consumers
      // even if audio produce fails (e.g. no microphone)
      centralWs.send('call.capabilities', {
        call_id: d.call_id,
        rtp_capabilities: device.rtpCapabilities,
      });
      console.log('[call:debug] sent call.capabilities to server');
      break;
    }

    case 'call.transport_created': {
      // Guard: skip if we already created transports for this call
      if (useCallStore.getState().sendTransport) {
        console.log('[call:debug] transport_created SKIPPED (transports already exist)');
        break;
      }
      console.log('[call:debug] transport_created received');
      const device = useCallStore.getState().device;
      if (!device) { console.warn('[call:debug] NO DEVICE — skipping transport_created'); break; }

      const callId = d.call_id as string;
      const sendParams = d.sendTransport as Record<string, unknown>;
      const recvParams = d.recvTransport as Record<string, unknown>;

      if (sendParams) {
        const sendTransport = device.createSendTransport(
          sendParams as Parameters<typeof device.createSendTransport>[0],
        );
        console.log('[call:debug] sendTransport created, id:', sendTransport.id);
        sendTransport.on('connect', ({ dtlsParameters }, callback) => {
          console.log('[call:debug] sendTransport connect event fired');
          centralWs.send('call.connect_transport', {
            call_id: callId,
            transport_id: sendTransport.id,
            dtls_parameters: dtlsParameters,
          });
          callback();
        });
        sendTransport.on('connectionstatechange', (state) => {
          console.log('[call:debug] sendTransport connectionState:', state);
        });
        sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback) => {
          console.log('[call:debug] sendTransport produce event:', kind, 'source:', (appData as Record<string, unknown>)?.source);
          const idPromise = new Promise<string>((resolve) => {
            pendingCallProduceResolve = resolve;
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
          console.log('[call:debug] produce confirmed, producer id:', id);
          callback({ id });
        });
        useCallStore.getState().setSendTransport(sendTransport);

        // Auto-produce audio (gracefully handle missing devices)
        try {
          const savedAudioDevice = localStorage.getItem('ecto-audio-device');
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: savedAudioDevice ? { deviceId: { ideal: savedAudioDevice } } : true,
          });
          const audioTrack = stream.getAudioTracks()[0]!;
          console.log('[call:debug] audio track obtained, producing...');
          const producer = await sendTransport.produce({ track: audioTrack, appData: { source: 'mic' } });
          console.log('[call:debug] audio producer created, id:', producer.id, 'paused:', producer.paused);
          useCallStore.getState().setProducer('audio', producer);
          useCallStore.getState().setLocalAudioStream(stream);

          // Speaking detection
          localSpeakingCleanup = startSpeakingDetection(stream, (speaking) => {
            useCallStore.getState().setLocalSpeaking(speaking);
          });
        } catch (err) {
          console.warn('[call] audio setup failed (no microphone?):', err);
          // Continue without audio — call can still work for receiving/video/screen
        }

        // Auto-produce video if the call was initiated with video
        if (useCallStore.getState().mediaTypes.includes('video')) {
          try {
            const savedVideoDevice = localStorage.getItem('ecto-video-device');
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
        console.log('[call:debug] recvTransport created, id:', recvTransport.id);
        recvTransport.on('connect', ({ dtlsParameters }, callback) => {
          console.log('[call:debug] recvTransport connect event fired');
          centralWs.send('call.connect_transport', {
            call_id: callId,
            transport_id: recvTransport.id,
            dtls_parameters: dtlsParameters,
          });
          callback();
        });
        recvTransport.on('connectionstatechange', (state) => {
          console.log('[call:debug] recvTransport connectionState:', state);
        });
        useCallStore.getState().setRecvTransport(recvTransport);
      }

      useCallStore.getState().setActive();
      console.log('[call:debug] call set to active');
      break;
    }

    case 'call.new_consumer': {
      console.log('[call:debug] call.new_consumer received:', {
        consumer_id: d.consumer_id,
        producer_id: d.producer_id,
        kind: d.kind,
        user_id: d.user_id,
        app_data: d.app_data,
        has_rtp_parameters: !!d.rtp_parameters,
      });
      const recvTransport = useCallStore.getState().recvTransport;
      if (!recvTransport) {
        console.error('[call:debug] NO recvTransport — cannot consume!');
        break;
      }

      const producerId = d.producer_id as string;

      // Skip duplicate consumers for the same producer
      if (consumedProducerIds.has(producerId)) {
        console.warn('[call:debug] duplicate producer, skipping:', producerId);
        break;
      }
      consumedProducerIds.add(producerId);

      // Serialize consume operations to prevent SDP conflicts
      const consumeData = { ...d };
      consumeQueue = consumeQueue.then(async () => {
        try {
          console.log('[call:debug] consuming... recvTransport state:', recvTransport.connectionState);
          const consumer = await recvTransport.consume({
            id: consumeData.consumer_id as string,
            producerId: consumeData.producer_id as string,
            kind: consumeData.kind as 'audio' | 'video',
            rtpParameters: consumeData.rtp_parameters as Parameters<typeof recvTransport.consume>[0]['rtpParameters'],
          });

          console.log('[call:debug] consume OK:', {
            consumerId: consumer.id,
            kind: consumer.kind,
            paused: consumer.paused,
            trackState: consumer.track.readyState,
            trackEnabled: consumer.track.enabled,
            trackMuted: consumer.track.muted,
          });

          useCallStore.getState().setConsumer(consumer.id, consumer);

          // Wait for transport to be connected before resuming so the
          // server-side keyframe isn't dropped during ICE/DTLS handshake
          const sendResume = () => {
            console.log('[call:debug] sending consumer_resume for', consumer.id, 'kind:', consumer.kind);
            centralWs.send('call.consumer_resume', {
              call_id: consumeData.call_id,
              consumer_id: consumer.id,
            });
          };
          if (recvTransport.connectionState === 'connected') {
            console.log('[call:debug] recvTransport already connected, resuming immediately');
            sendResume();
          } else {
            console.log('[call:debug] recvTransport NOT connected (state:', recvTransport.connectionState, '), waiting...');
            const onState = (state: string) => {
              console.log('[call:debug] recvTransport state changed to:', state, '(waiting for connected)');
              if (state === 'connected') {
                sendResume();
                recvTransport.removeListener('connectionstatechange', onState);
              }
            };
            recvTransport.on('connectionstatechange', onState);
          }

          const appData = consumeData.app_data as Record<string, unknown> | undefined;
          const source = appData?.source as string | undefined;
          console.log('[call:debug] consumer source:', source, 'kind:', consumer.kind);

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
            const savedOutput = localStorage.getItem('ecto-audio-output');
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
            console.log('[call:debug] creating video MediaStream, track:', {
              id: consumer.track.id,
              readyState: consumer.track.readyState,
              enabled: consumer.track.enabled,
              muted: consumer.track.muted,
            });
            if (source === 'screen') {
              useCallStore.getState().setRemoteScreenStream(stream);
              console.log('[call:debug] setRemoteScreenStream done');
            } else {
              useCallStore.getState().setRemoteVideoStream(stream);
              console.log('[call:debug] setRemoteVideoStream done');
            }

            // Monitor track state changes
            consumer.track.addEventListener('ended', () => {
              console.warn('[call:debug] VIDEO TRACK ENDED for consumer', consumer.id);
            });
            consumer.track.addEventListener('mute', () => {
              console.warn('[call:debug] VIDEO TRACK MUTED for consumer', consumer.id);
            });
            consumer.track.addEventListener('unmute', () => {
              console.log('[call:debug] VIDEO TRACK UNMUTED for consumer', consumer.id);
            });

            // Log RTP stats after 2s to check if data is flowing
            setTimeout(async () => {
              if (consumer.closed) { console.log('[call:debug] consumer closed before stats check'); return; }
              try {
                const stats = await consumer.getStats();
                for (const report of stats.values()) {
                  if (report.type === 'inbound-rtp' && report.kind === 'video') {
                    console.log('[call:debug] VIDEO RTP stats @2s:', {
                      bytesReceived: report.bytesReceived,
                      packetsReceived: report.packetsReceived,
                      packetsLost: report.packetsLost,
                      framesDecoded: report.framesDecoded,
                      framesDropped: report.framesDropped,
                      frameWidth: report.frameWidth,
                      frameHeight: report.frameHeight,
                      framesPerSecond: report.framesPerSecond,
                    });
                  }
                }
              } catch { /* ignore */ }
            }, 2000);
          }
        } catch (err) {
          console.error('[call:debug] consume FAILED for producer', producerId, err);
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
      useCallStore.getState().setEnded(reason);

      // Clean up after a brief display
      setTimeout(() => {
        cleanupCall();
      }, 3000);
      break;
    }

    case 'call.reconnected': {
      // Peer reconnected — state update will follow
      break;
    }
  }
}

function cleanupCall(): void {
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
  consumedProducerIds.clear();
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
    if (!centralWs) return;

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
    const { callId } = useCallStore.getState();
    if (!callId) return;
    const centralWs = connectionManager.getCentralWs();
    if (!centralWs) return;

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
      console.log('[call:debug] toggleVideo OFF — closing producer:', producer.id);
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
      console.log('[call:debug] toggleVideo ON — sendTransport state:', sendTransport.connectionState);
      try {
        const savedVideoDevice = localStorage.getItem('ecto-video-device');
        const preset = CAMERA_PRESETS[getVideoQuality()];
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            ...preset.constraints,
            ...(savedVideoDevice ? { deviceId: { ideal: savedVideoDevice } } : {}),
          },
        });
        const videoTrack = stream.getVideoTracks()[0]!;
        console.log('[call:debug] got video track:', {
          id: videoTrack.id,
          readyState: videoTrack.readyState,
          enabled: videoTrack.enabled,
          muted: videoTrack.muted,
          width: videoTrack.getSettings().width,
          height: videoTrack.getSettings().height,
        });
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
        console.log('[call:debug] video producer created:', {
          id: producer.id,
          kind: producer.kind,
          paused: producer.paused,
          closed: producer.closed,
          trackReadyState: producer.track?.readyState,
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
      console.log('[call:debug] toggleScreenShare ON — sendTransport state:', sendTransport.connectionState);
      try {
        const screenPreset = SCREEN_PRESETS[getScreenQuality()];
        const stream = await navigator.mediaDevices.getDisplayMedia(screenPreset.constraints);
        const screenTrack = stream.getVideoTracks()[0]!;
        screenTrack.contentHint = screenPreset.contentHint;
        console.log('[call:debug] got screen track:', {
          id: screenTrack.id,
          readyState: screenTrack.readyState,
          width: screenTrack.getSettings().width,
          height: screenTrack.getSettings().height,
        });

        // Prefer VP9 for screen content (better compression, sharper text)
        const device = useCallStore.getState().device;
        const vp9Codec = device?.rtpCapabilities.codecs?.find(
          (c) => c.mimeType.toLowerCase() === 'video/vp9',
        );
        console.log('[call:debug] screen share codec:', vp9Codec ? `${vp9Codec.mimeType}` : 'default (no VP9)');

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
        console.log('[call:debug] screen producer created:', {
          id: producer.id,
          paused: producer.paused,
          closed: producer.closed,
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
    localStorage.setItem('ecto-audio-output', deviceId);
    // Update the call audio element
    if (callAudioElement && 'setSinkId' in callAudioElement) {
      await (callAudioElement as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(deviceId).catch(() => {});
    }
    // Also update any extra call audio elements (screen-audio)
    const extras = document.querySelectorAll<HTMLAudioElement>('audio[data-call-audio]');
    for (const el of extras) {
      if ('setSinkId' in el) {
        await (el as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(deviceId).catch(() => {});
      }
    }
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
    startCall,
    answerCall,
    rejectCall,
    endCall,
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
