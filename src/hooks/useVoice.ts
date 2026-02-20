import { useCallback, useEffect } from 'react';
import { Device } from 'mediasoup-client';
import { useVoiceStore } from '../stores/voice.js';
import { useAuthStore } from '../stores/auth.js';
import { useServerStore } from '../stores/server.js';
import { connectionManager } from '../services/connection-manager.js';
import { useCallStore } from '../stores/call.js';
import { preferenceManager } from '../services/preference-manager.js';
import {
  CAMERA_PRESETS,
  SCREEN_PRESETS,
  getVideoQuality,
  getScreenQuality,
  setVideoQuality,
  setScreenQuality,
} from '../lib/media-presets.js';
import { startSpeakingDetection, switchAudioOutputDevice, getAudioStream, getVideoStream } from '../lib/media-utils.js';
export type { VideoQuality, ScreenQuality } from '../lib/media-presets.js';

/** Get local user ID — Central account user ID, or server-specific user ID for local accounts */
function getLocalUserId(): string | undefined {
  const centralUser = useAuthStore.getState().user?.id;
  if (centralUser) return centralUser;
  const serverId = useVoiceStore.getState().currentServerId;
  if (!serverId) return undefined;
  return useServerStore.getState().serverMeta.get(serverId)?.user_id ?? undefined;
}

let speakingCleanup: (() => void) | null = null;
let voiceEventQueue: Promise<void> = Promise.resolve();
let pendingProduceResolve: ((id: string) => void) | null = null;
let pendingProduceReject: ((err: Error) => void) | null = null;
const consumerSpeakingCleanups = new Map<string, () => void>();

/** Start speaking detection that updates the voice store for a given user. */
function startVoiceSpeakingDetection(stream: MediaStream, userId: string): () => void {
  return startSpeakingDetection(
    stream,
    (speaking) => { useVoiceStore.getState().setSpeaking(userId, speaking); },
    (level) => { useVoiceStore.getState().setAudioLevel(userId, level); },
  );
}

export function useVoice() {
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const currentServerId = useVoiceStore((s) => s.currentServerId);
  const voiceStatus = useVoiceStore((s) => s.voiceStatus);
  const selfMuted = useVoiceStore((s) => s.selfMuted);
  const selfDeafened = useVoiceStore((s) => s.selfDeafened);
  const participants = useVoiceStore((s) => s.participants);
  const speaking = useVoiceStore((s) => s.speaking);
  const pendingTransfer = useVoiceStore((s) => s.pendingTransfer);

  // Push-to-talk key listeners
  const pttEnabled = useVoiceStore((s) => s.pttEnabled);
  const pttKey = useVoiceStore((s) => s.pttKey);

  useEffect(() => {
    if (!pttEnabled || !currentChannelId) return;

    // When PTT is enabled, start with mic paused
    const audioProducer = useVoiceStore.getState().producers.get('audio');
    if (audioProducer && !audioProducer.paused) {
      audioProducer.pause();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === pttKey) {
        const producer = useVoiceStore.getState().producers.get('audio');
        if (producer && producer.paused) {
          producer.resume();
          useVoiceStore.getState().setPttActive(true);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === pttKey) {
        const producer = useVoiceStore.getState().producers.get('audio');
        if (producer && !producer.paused) {
          producer.pause();
          useVoiceStore.getState().setPttActive(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      // Resume mic when PTT is disabled
      const producer = useVoiceStore.getState().producers.get('audio');
      if (producer && producer.paused && !useVoiceStore.getState().selfMuted) {
        producer.resume();
      }
      useVoiceStore.getState().setPttActive(false);
    };
  }, [pttEnabled, pttKey, currentChannelId]);

  const joinVoice = useCallback(async (serverId: string, channelId: string, force?: boolean) => {
    const ws = connectionManager.getMainWs(serverId);
    if (!ws) return;

    const { currentChannelId: curChannel, currentServerId: curServer } = useVoiceStore.getState();
    const callState = useCallStore.getState().callState;

    // Already in a 1:1 call — store pending transfer for UI to confirm
    if (callState !== 'idle' && !force) {
      useVoiceStore.getState().setPendingTransfer({
        serverId,
        channelId,
        currentChannelId: 'call',
        sameSession: true,
      });
      return;
    }

    // Already connected to the same channel on this session — no-op
    // But if still 'connecting', allow retry (e.g. after WS reconnect lost the voice handshake)
    if (curChannel === channelId && curServer === serverId) {
      if (useVoiceStore.getState().voiceStatus !== 'connecting') return;
      // Reset stale connecting state and fall through to re-join
      speakingCleanup?.();
      speakingCleanup = null;
      for (const cleanup of consumerSpeakingCleanups.values()) cleanup();
      consumerSpeakingCleanups.clear();
      useVoiceStore.getState().cleanup();
    } else if (curChannel && !force) {
      // Connected to a different channel on this session — store pending transfer for UI
      useVoiceStore.getState().setPendingTransfer({
        serverId,
        channelId,
        currentChannelId: curChannel,
        sameSession: true,
      });
      return;
    }

    // If force-joining from same session, leave current first
    if (curChannel && force) {
      const curWs = curServer ? connectionManager.getMainWs(curServer) : null;
      curWs?.voiceLeave(curChannel);
      speakingCleanup?.();
      speakingCleanup = null;
      for (const cleanup of consumerSpeakingCleanups.values()) cleanup();
      consumerSpeakingCleanups.clear();
      useVoiceStore.getState().cleanup();
    }

    useVoiceStore.getState().setChannel(serverId, channelId);
    ws.voiceJoin(channelId, force);

    // Voice events are queued to prevent race conditions between async handlers
    voiceEventQueue = Promise.resolve();
    const originalOnEvent = ws.onEvent;
    ws.onEvent = (event, data, seq) => {
      originalOnEvent?.(event, data, seq);

      // Resolve pending produce callback immediately to avoid deadlock
      if (event === 'voice.produced') {
        const d = data as Record<string, unknown>;
        pendingProduceResolve?.(d.producer_id as string);
        pendingProduceResolve = null;
        pendingProduceReject = null;
        return;
      }

      // Reject pending produce on error to avoid deadlock — then let it flow into queue for cleanup
      if (event === 'voice.error' && pendingProduceReject) {
        const d = data as Record<string, unknown>;
        pendingProduceReject(new Error(`voice.error: ${d.code} ${d.message}`));
        pendingProduceResolve = null;
        pendingProduceReject = null;
      }

      voiceEventQueue = voiceEventQueue.then(() => handleVoiceEvent(ws, event, data)).catch((err) => {
        console.error('[voice] event handler error:', event, err);
      });
    };
  }, []);

  const leaveVoice = useCallback(() => {
    const { currentServerId: sid, currentChannelId: cid } = useVoiceStore.getState();
    if (!sid || !cid) return;
    const ws = connectionManager.getMainWs(sid);
    ws?.voiceLeave(cid);
    speakingCleanup?.();
    speakingCleanup = null;
    for (const cleanup of consumerSpeakingCleanups.values()) cleanup();
    consumerSpeakingCleanups.clear();
    pendingProduceResolve = null;
    pendingProduceReject = null;
    useVoiceStore.getState().cleanup();
  }, []);

  const toggleMute = useCallback(() => {
    useVoiceStore.getState().toggleMute();
    const { selfMuted: muted, selfDeafened: deaf, currentServerId: sid } = useVoiceStore.getState();
    const ws = sid ? connectionManager.getMainWs(sid) : null;
    ws?.voiceMute(muted, deaf);

    const audioProducer = useVoiceStore.getState().producers.get('audio');
    if (audioProducer) {
      if (muted) audioProducer.pause();
      else audioProducer.resume();
    }
  }, []);

  const toggleDeafen = useCallback(() => {
    useVoiceStore.getState().toggleDeafen();
    const { selfMuted: muted, selfDeafened: deaf, currentServerId: sid } = useVoiceStore.getState();
    const ws = sid ? connectionManager.getMainWs(sid) : null;
    ws?.voiceMute(muted, deaf);
  }, []);

  const switchAudioDevice = useCallback(async (deviceId: string) => {
    const { producers } = useVoiceStore.getState();
    const audioProducer = producers.get('audio');
    if (!audioProducer) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
      });
      const newTrack = stream.getAudioTracks()[0]!;
      await audioProducer.replaceTrack({ track: newTrack });

      speakingCleanup?.();
      const localUserId = getLocalUserId();
      if (localUserId) speakingCleanup = startVoiceSpeakingDetection(stream, localUserId);
    } catch (err) {
      console.error('[voice] failed to switch audio device:', err);
    }
  }, []);

  const switchAudioOutput = useCallback(async (deviceId: string) => {
    preferenceManager.setDevice('audio-output', deviceId);
    const audioEls = document.querySelectorAll<HTMLAudioElement>('audio[data-consumer-id]');
    await switchAudioOutputDevice(audioEls, deviceId);
  }, []);

  const switchVideoDevice = useCallback(async (deviceId: string) => {
    const { producers } = useVoiceStore.getState();
    const userId = getLocalUserId();
    const videoProducer = producers.get('video');
    if (!videoProducer || !userId) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { ...CAMERA_PRESETS[getVideoQuality()].constraints, deviceId: { exact: deviceId } },
      });
      const newTrack = stream.getVideoTracks()[0]!;
      await videoProducer.replaceTrack({ track: newTrack });
      useVoiceStore.getState().setVideoStream(userId, new MediaStream([newTrack]));
    } catch (err) {
      console.error('[voice] failed to switch video device:', err);
    }
  }, []);

  const toggleCamera = useCallback(async () => {
    const { sendTransport, producers, currentServerId: sid } = useVoiceStore.getState();
    const ws = sid ? connectionManager.getMainWs(sid) : null;
    const userId = getLocalUserId();

    if (producers.has('video')) {
      const producer = producers.get('video')!;
      if (ws && producer.id) ws.voiceProduceStop(producer.id);
      useVoiceStore.getState().removeProducer('video');
      if (userId) useVoiceStore.getState().setVideoStream(userId, null);
    } else if (sendTransport && ws) {
      const savedVideoDevice = preferenceManager.getDevice('video-input', '');
      const preset = CAMERA_PRESETS[getVideoQuality()];
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { ...preset.constraints, ...(savedVideoDevice ? { deviceId: { ideal: savedVideoDevice } } : {}) },
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
      useVoiceStore.getState().setProducer('video', producer);
      if (userId) useVoiceStore.getState().setVideoStream(userId, new MediaStream([videoTrack]));
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const { sendTransport, producers, currentServerId: sid } = useVoiceStore.getState();
    const userId = getLocalUserId();

    if (producers.has('screen')) {
      const ws = sid ? connectionManager.getMainWs(sid) : null;
      const screenProducer = producers.get('screen')!;
      if (ws && screenProducer.id) ws.voiceProduceStop(screenProducer.id);
      useVoiceStore.getState().removeProducer('screen');
      // Also stop screen audio if active
      const screenAudioProducer = producers.get('screen-audio');
      if (screenAudioProducer) {
        if (ws && screenAudioProducer.id) ws.voiceProduceStop(screenAudioProducer.id);
        useVoiceStore.getState().removeProducer('screen-audio');
      }
      if (userId) useVoiceStore.getState().setScreenStream(userId, null);
    } else if (sendTransport) {
      try {
        const screenPreset = SCREEN_PRESETS[getScreenQuality()];
        const stream = await navigator.mediaDevices.getDisplayMedia(screenPreset.constraints);
        const screenTrack = stream.getVideoTracks()[0]!;
        screenTrack.contentHint = screenPreset.contentHint;

        // Prefer VP9 for screen content (better compression, sharper text)
        const device = useVoiceStore.getState().device;
        const vp9Codec = device?.rtpCapabilities.codecs?.find(
          (c) => c.mimeType.toLowerCase() === 'video/vp9',
        );

        // Derive codec bitrate params from preset (values in kbps)
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
        useVoiceStore.getState().setProducer('screen', producer);
        if (userId) useVoiceStore.getState().setScreenStream(userId, new MediaStream([screenTrack]));

        // Produce screen audio if the stream has an audio track (tab/app audio)
        const screenAudioTrack = stream.getAudioTracks()[0];
        if (screenAudioTrack) {
          const audioProducer = await sendTransport.produce({
            track: screenAudioTrack,
            appData: { source: 'screen-audio' },
          });
          useVoiceStore.getState().setProducer('screen-audio', audioProducer);
        }

        // Auto-cleanup when user clicks browser's "Stop sharing"
        screenTrack.addEventListener('ended', () => {
          const curState = useVoiceStore.getState();
          const curSid = curState.currentServerId;
          const curWs = curSid ? connectionManager.getMainWs(curSid) : null;
          const screenProd = curState.producers.get('screen');
          if (curWs && screenProd?.id) curWs.voiceProduceStop(screenProd.id);
          useVoiceStore.getState().removeProducer('screen');
          // Also stop screen audio
          const screenAudioProd = useVoiceStore.getState().producers.get('screen-audio');
          if (screenAudioProd) {
            if (curWs && screenAudioProd.id) curWs.voiceProduceStop(screenAudioProd.id);
            useVoiceStore.getState().removeProducer('screen-audio');
          }
          if (userId) useVoiceStore.getState().setScreenStream(userId, null);
        });
      } catch (err) {
        // User cancelled the display picker or getDisplayMedia failed
        console.error('[voice] screen share failed:', err);
      }
    }
  }, []);

  // setVideoQuality / setScreenQuality imported from shared media-presets

  /** Mute/unmute screen audio. Owner pauses producer for everyone; viewer mutes local element. */
  const toggleScreenAudioMute = useCallback((streamUserId: string): boolean => {
    const myUserId = getLocalUserId();
    const isOwner = streamUserId === myUserId;

    if (isOwner) {
      const producer = useVoiceStore.getState().producers.get('screen-audio');
      if (!producer || producer.closed) return false;
      const sid = useVoiceStore.getState().currentServerId;
      const ws = sid ? connectionManager.getMainWs(sid) : null;
      if (!ws) return false;
      if (producer.paused) {
        producer.resume();
        ws.voiceProducerResume(producer.id);
        return false; // now unmuted
      } else {
        producer.pause();
        ws.voiceProducerPause(producer.id);
        return true; // now muted
      }
    } else {
      // Find the screen-audio consumer <audio> element for this user
      const store = useVoiceStore.getState();
      for (const [cid, meta] of store.consumerMeta.entries()) {
        if (meta.userId === streamUserId && meta.source === 'screen-audio') {
          const el = document.querySelector(`audio[data-consumer-id="${cid}"]`) as HTMLAudioElement | null;
          if (el) {
            el.muted = !el.muted;
            return el.muted;
          }
        }
      }
      return false;
    }
  }, []);

  const confirmTransfer = useCallback(() => {
    const pending = useVoiceStore.getState().pendingTransfer;
    if (!pending) return;

    // If switching away from a call, end the call first
    if (pending.currentChannelId === 'call') {
      const { callId } = useCallStore.getState();
      if (callId) {
        const centralWs = connectionManager.getCentralWs();
        centralWs?.send('call.end', { call_id: callId });
        useCallStore.getState().cleanup();
      }
    }

    useVoiceStore.getState().setPendingTransfer(null);
    joinVoice(pending.serverId, pending.channelId, true);
  }, [joinVoice]);

  const cancelTransfer = useCallback(() => {
    useVoiceStore.getState().setPendingTransfer(null);
  }, []);

  const serverMuteUser = useCallback((userId: string, muted: boolean) => {
    const sid = useVoiceStore.getState().currentServerId;
    if (!sid) return;
    const ws = connectionManager.getMainWs(sid);
    ws?.voiceServerMute(userId, muted);
  }, []);

  const serverDeafenUser = useCallback((userId: string, deafened: boolean) => {
    const sid = useVoiceStore.getState().currentServerId;
    if (!sid) return;
    const ws = connectionManager.getMainWs(sid);
    ws?.voiceServerDeafen(userId, deafened);
  }, []);

  return {
    currentChannelId,
    currentServerId,
    voiceStatus,
    selfMuted,
    selfDeafened,
    participants,
    speaking,
    pendingTransfer,
    isInVoice: currentChannelId !== null,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    toggleScreenShare,
    switchAudioDevice,
    switchAudioOutput,
    switchVideoDevice,
    setVideoQuality,
    setScreenQuality,
    toggleScreenAudioMute,
    confirmTransfer,
    cancelTransfer,
    serverMuteUser,
    serverDeafenUser,
  };
}

async function handleVoiceEvent(ws: ReturnType<typeof connectionManager.getMainWs>, event: string, data: unknown) {
  if (!ws) return;
  const d = data as Record<string, unknown>;
  const store = useVoiceStore.getState();

  switch (event) {
    case 'voice.error': {
      console.error('[voice] server error:', d.code, d.message);
      speakingCleanup?.();
      useVoiceStore.getState().cleanup();
      break;
    }

    case 'voice.router_capabilities': {
      useVoiceStore.getState().setVoiceStatus('connected');
      const device = new Device();
      await device.load({ routerRtpCapabilities: d.rtpCapabilities as Parameters<typeof device.load>[0]['routerRtpCapabilities'] });
      useVoiceStore.getState().setDevice(device);
      // Send device capabilities so server can create consumers with correct codec params
      ws.voiceCapabilities(device.rtpCapabilities);
      break;
    }

    case 'voice.transport_created': {
      const device = useVoiceStore.getState().device;
      if (!device) break;

      const sendParams = d.send as Record<string, unknown>;
      const recvParams = d.recv as Record<string, unknown>;

      if (sendParams) {
        const sendTransport = device.createSendTransport(sendParams as Parameters<typeof device.createSendTransport>[0]);
        sendTransport.on('connect', ({ dtlsParameters }, callback) => {
          ws.voiceConnectTransport(sendTransport.id, dtlsParameters);
          callback();
        });
        sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback) => {
          const idPromise = new Promise<string>((resolve, reject) => {
            pendingProduceResolve = resolve;
            pendingProduceReject = reject;
          });
          ws.voiceProduce(sendTransport.id, kind as 'audio' | 'video', rtpParameters, appData?.source as string | undefined);
          const id = await idPromise;
          callback({ id });
        });
        useVoiceStore.getState().setSendTransport(sendTransport);

        try {
          const savedAudioDevice = preferenceManager.getDevice('audio-input', '');
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: savedAudioDevice ? { deviceId: { ideal: savedAudioDevice } } : true,
          });
          const audioTrack = stream.getAudioTracks()[0]!;
          try {
            const producer = await sendTransport.produce({ track: audioTrack, appData: { source: 'mic' } });
            useVoiceStore.getState().setProducer('audio', producer);
            const localUserId = getLocalUserId();
            if (localUserId) speakingCleanup = startVoiceSpeakingDetection(stream, localUserId);
          } catch (produceErr) {
            console.warn('[voice] produce rejected (permission denied?):', produceErr);
          }
        } catch (err) {
          console.error('[voice] audio setup failed:', err);
        }
      }

      if (recvParams) {
        const recvTransport = device.createRecvTransport(recvParams as Parameters<typeof device.createRecvTransport>[0]);
        recvTransport.on('connect', ({ dtlsParameters }, callback) => {
          ws.voiceConnectTransport(recvTransport.id, dtlsParameters);
          callback();
        });
        useVoiceStore.getState().setRecvTransport(recvTransport);
      }
      break;
    }

    case 'voice.new_consumer': {
      const recvTransport = useVoiceStore.getState().recvTransport;
      if (!recvTransport) break;
      const consumer = await recvTransport.consume({
        id: d.consumer_id as string,
        producerId: d.producer_id as string,
        kind: d.kind as 'audio' | 'video',
        rtpParameters: d.rtpParameters as Parameters<typeof recvTransport.consume>[0]['rtpParameters'],
      });
      const consumerSource = (d.source as string) ?? (consumer.kind === 'audio' ? 'mic' : 'camera');
      useVoiceStore.getState().setConsumer(consumer.id, consumer, {
        userId: d.user_id as string,
        source: consumerSource,
      });

      // Wait for transport to be connected before resuming so the
      // server-side keyframe isn't dropped during ICE/DTLS handshake
      const recvT = useVoiceStore.getState().recvTransport!;
      if (recvT.connectionState === 'connected') {
        ws.voiceConsumerResume(consumer.id);
      } else {
        const onState = (state: string) => {
          if (state === 'connected') {
            ws.voiceConsumerResume(consumer.id);
            recvT.removeListener('connectionstatechange', onState);
          }
        };
        recvT.on('connectionstatechange', onState);
      }

      if (consumer.kind === 'audio') {
        const audio = document.createElement('audio');
        const audioStream = new MediaStream([consumer.track]);
        audio.srcObject = audioStream;
        audio.autoplay = true;
        audio.dataset['consumerId'] = consumer.id;
        // Apply saved audio output device
        const savedOutput = preferenceManager.getDevice('audio-output', '');
        if (savedOutput && 'setSinkId' in audio) {
          (audio as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(savedOutput).catch(() => {});
        }
        document.body.appendChild(audio);
        // Start speaking detection for remote user (skip screen audio)
        const remoteUserId = d.user_id as string;
        if (remoteUserId && consumerSource !== 'screen-audio') {
          const cleanup = startVoiceSpeakingDetection(audioStream, remoteUserId);
          consumerSpeakingCleanups.set(consumer.id, cleanup);
        }
      } else if (consumer.kind === 'video') {
        const userId = d.user_id as string;
        if (d.source === 'screen') {
          useVoiceStore.getState().setScreenStream(userId, new MediaStream([consumer.track]));
        } else {
          useVoiceStore.getState().setVideoStream(userId, new MediaStream([consumer.track]));
        }
      }
      break;
    }

    case 'voice.producer_closed': {
      const producerId = d.producer_id as string ?? d.producerId as string;
      const entry = [...store.consumers.entries()].find(
        ([, c]) => c.producerId === producerId,
      );
      if (entry) {
        const [consumerId, consumer] = entry;
        useVoiceStore.getState().removeConsumer(consumerId);
        const audioEl = document.querySelector(`audio[data-consumer-id="${consumerId}"]`);
        audioEl?.remove();
        // Clean up remote speaking detection
        const speakingCleanupFn = consumerSpeakingCleanups.get(consumerId);
        if (speakingCleanupFn) {
          speakingCleanupFn();
          consumerSpeakingCleanups.delete(consumerId);
        }
        // Clear video/screen stream if it was a video consumer
        if (consumer.kind === 'video') {
          const userId = d.user_id as string;
          if (userId) {
            // Check if this stream exists in screenStreams — if so, clear it; otherwise clear videoStreams
            if (useVoiceStore.getState().screenStreams.has(userId)) {
              useVoiceStore.getState().setScreenStream(userId, null);
            } else {
              useVoiceStore.getState().setVideoStream(userId, null);
            }
          }
        }
      }
      break;
    }

    case 'voice.already_connected': {
      // Server says we're already in voice (on another session or channel)
      // Capture the target channel we were trying to join before resetting it
      const { currentChannelId: targetChannel, currentServerId: targetServer } = useVoiceStore.getState();
      // Only reset the optimistic connection state — preserve participants so
      // the voice channel still shows who's in it
      useVoiceStore.setState({
        currentChannelId: null,
        currentServerId: null,
        voiceStatus: 'disconnected' as const,
        pendingTransfer: {
          serverId: targetServer ?? '',
          channelId: targetChannel ?? '',
          currentChannelId: d.channel_id as string,
          sameSession: d.same_session as boolean,
        },
      });
      break;
    }

    case 'voice.transferred': {
      // Another session took over our voice connection — clean up locally
      speakingCleanup?.();
      speakingCleanup = null;
      for (const cleanup of consumerSpeakingCleanups.values()) cleanup();
      consumerSpeakingCleanups.clear();
      pendingProduceResolve = null;
      pendingProduceReject = null;
      useVoiceStore.getState().cleanup();
      break;
    }
  }
}
