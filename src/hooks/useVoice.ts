import { useCallback, useEffect } from 'react';
import { useVoiceStore } from '../stores/voice.js';
import { useCallStore } from '../stores/call.js';
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
import { switchAudioOutputDevice } from '../lib/media-utils.js';
import {
  getLocalUserId,
  cleanupVoiceSession,
  restoreWsHandler,
  setupVoiceEventHandling,
  replaceAudioTrack,
} from '../services/voice-media.js';

export { resetVoiceSessionState } from '../services/voice-media.js';
export type { VideoQuality, ScreenQuality } from '../lib/media-presets.js';

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
      cleanupVoiceSession();
      useVoiceStore.getState().cleanup();
    } else if (curChannel && !force) {
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
      cleanupVoiceSession();
      useVoiceStore.getState().cleanup();
    }

    setupVoiceEventHandling(ws, serverId, channelId, force);
  }, []);

  const leaveVoice = useCallback(() => {
    const { currentServerId: sid, currentChannelId: cid } = useVoiceStore.getState();
    if (!sid || !cid) return;
    const ws = connectionManager.getMainWs(sid);
    ws?.voiceLeave(cid);
    cleanupVoiceSession();
    useVoiceStore.getState().cleanup();
    restoreWsHandler(ws);
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
    const { selfMuted: muted, selfDeafened: deaf, currentServerId: sid, consumers, consumerMeta } = useVoiceStore.getState();
    const ws = sid ? connectionManager.getMainWs(sid) : null;
    ws?.voiceMute(muted, deaf);

    for (const [consumerId, consumer] of consumers) {
      const meta = consumerMeta.get(consumerId);
      if (meta?.source === 'audio') {
        if (deaf) consumer.pause();
        else consumer.resume();
      }
    }

    const audioProducer = useVoiceStore.getState().producers.get('audio');
    if (audioProducer) {
      if (muted) audioProducer.pause();
      else audioProducer.resume();
    }
  }, []);

  const switchAudioDevice = useCallback(async (deviceId: string) => {
    try {
      await replaceAudioTrack(deviceId);
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

        const device = useVoiceStore.getState().device;
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
        useVoiceStore.getState().setProducer('screen', producer);
        if (userId) useVoiceStore.getState().setScreenStream(userId, new MediaStream([screenTrack]));

        const screenAudioTrack = stream.getAudioTracks()[0];
        if (screenAudioTrack) {
          const audioProducer = await sendTransport.produce({
            track: screenAudioTrack,
            appData: { source: 'screen-audio' },
          });
          useVoiceStore.getState().setProducer('screen-audio', audioProducer);
        }

        screenTrack.addEventListener('ended', () => {
          const curState = useVoiceStore.getState();
          const curSid = curState.currentServerId;
          const curWs = curSid ? connectionManager.getMainWs(curSid) : null;
          const screenProd = curState.producers.get('screen');
          if (curWs && screenProd?.id) curWs.voiceProduceStop(screenProd.id);
          useVoiceStore.getState().removeProducer('screen');
          const screenAudioProd = useVoiceStore.getState().producers.get('screen-audio');
          if (screenAudioProd) {
            if (curWs && screenAudioProd.id) curWs.voiceProduceStop(screenAudioProd.id);
            useVoiceStore.getState().removeProducer('screen-audio');
          }
          if (userId) useVoiceStore.getState().setScreenStream(userId, null);
        });
      } catch (err) {
        console.error('[voice] screen share failed:', err);
      }
    }
  }, []);

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
        return false;
      } else {
        producer.pause();
        ws.voiceProducerPause(producer.id);
        return true;
      }
    } else {
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
