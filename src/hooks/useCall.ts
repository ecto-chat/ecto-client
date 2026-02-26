import { useCallback } from 'react';
import { useCallStore } from '../stores/call.js';
import { useVoiceStore } from '../stores/voice.js';
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
import {
  cleanupCall,
  sendMuteUpdate,
  resetConsumedProducerIds,
  getCallAudioElement,
  resetCallEventQueue,
} from '../services/call-media.js';

export { handleCallWsEvent } from '../services/call-media.js';

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
  const answeredElsewhere = useCallStore((s) => s.answeredElsewhere);

  const startCall = useCallback((targetUserId: string, mediaTypes: ('audio' | 'video')[]) => {
    const centralWs = connectionManager.getCentralWs();
    if (!centralWs) return;

    if (useCallStore.getState().callState === 'ended') cleanupCall();
    const currentState = useCallStore.getState().callState;
    if (currentState !== 'idle') return;

    const { currentChannelId, currentServerId } = useVoiceStore.getState();
    if (currentChannelId && currentServerId) {
      const ws = connectionManager.getMainWs(currentServerId);
      ws?.voiceLeave(currentChannelId);
      useVoiceStore.getState().cleanup();
    }

    const friend = useFriendStore.getState().friends.get(targetUserId);
    if (friend) {
      useCallStore.getState().setOutgoingCall(
        '',
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
    resetCallEventQueue();
  }, []);

  const answerCall = useCallback((withVideo?: boolean) => {
    const { callId } = useCallStore.getState();
    if (!callId) return;
    const centralWs = connectionManager.getCentralWs();
    if (!centralWs) return;

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
      const producer = producers.get('video')!;
      if (centralWs && callId) {
        centralWs.send('call.produce_stop', { call_id: callId, producer_id: producer.id });
      }
      useCallStore.getState().removeProducer('video');
      useCallStore.getState().setLocalVideoStream(null);
      useCallStore.getState().toggleVideo();
      sendMuteUpdate();
    } else if (sendTransport && centralWs) {
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
      const screenProducer = producers.get('screen')!;
      if (centralWs && callId) {
        centralWs.send('call.produce_stop', { call_id: callId, producer_id: screenProducer.id });
      }
      useCallStore.getState().removeProducer('screen');
      const screenAudioProducer = producers.get('screen-audio');
      if (screenAudioProducer) {
        if (centralWs && callId) {
          centralWs.send('call.produce_stop', { call_id: callId, producer_id: screenAudioProducer.id });
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

        const screenAudioTrack = stream.getAudioTracks()[0];
        if (screenAudioTrack) {
          const audioProducer = await sendTransport.produce({
            track: screenAudioTrack,
            appData: { source: 'screen-audio' },
          });
          useCallStore.getState().setProducer('screen-audio', audioProducer);
        }

        screenTrack.addEventListener('ended', () => {
          const curState = useCallStore.getState();
          const curCallId = curState.callId;
          const curWs = connectionManager.getCentralWs();
          const screenProd = curState.producers.get('screen');
          if (curWs && screenProd?.id && curCallId) {
            curWs.send('call.produce_stop', { call_id: curCallId, producer_id: screenProd.id });
          }
          useCallStore.getState().removeProducer('screen');
          const screenAudioProd = useCallStore.getState().producers.get('screen-audio');
          if (screenAudioProd) {
            if (curWs && screenAudioProd.id && curCallId) {
              curWs.send('call.produce_stop', { call_id: curCallId, producer_id: screenAudioProd.id });
            }
            useCallStore.getState().removeProducer('screen-audio');
          }
          useCallStore.getState().setLocalScreenStream(null);
          if (curState.screenSharing) useCallStore.getState().toggleScreenSharing();
          sendMuteUpdate();
        });
      } catch (err) {
        console.error('[call] screen share failed:', err);
      }
    }
  }, []);

  const transferCall = useCallback(() => {
    const { callId } = useCallStore.getState();
    if (!callId) return;
    const centralWs = connectionManager.getCentralWs();
    if (!centralWs) return;

    useCallStore.setState({ answeredElsewhere: false, device: null, sendTransport: null, recvTransport: null });
    resetConsumedProducerIds();
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
    } catch (err) {
      console.error('[call] failed to switch audio device:', err);
    }
  }, []);

  const switchAudioOutput = useCallback(async (deviceId: string) => {
    preferenceManager.setDevice('audio-output', deviceId);
    const elements: (HTMLAudioElement | HTMLVideoElement)[] = [];
    const mainAudio = getCallAudioElement();
    if (mainAudio) elements.push(mainAudio);
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
