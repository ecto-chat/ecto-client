import { useCallback } from 'react';
import { Device } from 'mediasoup-client';
import { useVoiceStore } from '../stores/voice.js';
import { useAuthStore } from '../stores/auth.js';
import { connectionManager } from '../services/connection-manager.js';

let speakingCleanup: (() => void) | null = null;
let voiceEventQueue: Promise<void> = Promise.resolve();

function startSpeakingDetection(stream: MediaStream) {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;

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
      useVoiceStore.getState().setSpeaking(userId, isSpeaking);
    }
  }, 100);

  speakingCleanup = () => {
    clearInterval(interval);
    source.disconnect();
    audioCtx.close().catch(() => {});
    speakingCleanup = null;
  };
}

export function useVoice() {
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const currentServerId = useVoiceStore((s) => s.currentServerId);
  const voiceStatus = useVoiceStore((s) => s.voiceStatus);
  const selfMuted = useVoiceStore((s) => s.selfMuted);
  const selfDeafened = useVoiceStore((s) => s.selfDeafened);
  const participants = useVoiceStore((s) => s.participants);
  const speaking = useVoiceStore((s) => s.speaking);

  const joinVoice = useCallback(async (serverId: string, channelId: string) => {
    const ws = connectionManager.getMainWs(serverId);
    if (!ws) return;

    useVoiceStore.getState().setChannel(serverId, channelId);
    ws.voiceJoin(channelId);

    // Voice events are queued to prevent race conditions between async handlers
    voiceEventQueue = Promise.resolve();
    const originalOnEvent = ws.onEvent;
    ws.onEvent = (event, data, seq) => {
      originalOnEvent?.(event, data, seq);
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
      startSpeakingDetection(stream);
    } catch (err) {
      console.error('[voice] failed to switch audio device:', err);
    }
  }, []);

  const switchVideoDevice = useCallback(async (deviceId: string) => {
    const { producers } = useVoiceStore.getState();
    const userId = useAuthStore.getState().user?.id;
    const videoProducer = producers.get('video');
    if (!videoProducer || !userId) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
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
    const userId = useAuthStore.getState().user?.id;

    if (producers.has('video')) {
      useVoiceStore.getState().removeProducer('video');
      if (userId) useVoiceStore.getState().setVideoStream(userId, null);
    } else if (sendTransport && ws) {
      const savedVideoDevice = localStorage.getItem('ecto-video-device');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: savedVideoDevice ? { deviceId: { ideal: savedVideoDevice } } : true,
      });
      const videoTrack = stream.getVideoTracks()[0]!;
      const producer = await sendTransport.produce({ track: videoTrack });
      useVoiceStore.getState().setProducer('video', producer);
      if (userId) useVoiceStore.getState().setVideoStream(userId, new MediaStream([videoTrack]));
    }
  }, []);

  return {
    currentChannelId,
    currentServerId,
    voiceStatus,
    selfMuted,
    selfDeafened,
    participants,
    speaking,
    isInVoice: currentChannelId !== null,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    switchAudioDevice,
    switchVideoDevice,
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
        sendTransport.on('produce', ({ kind, rtpParameters }, callback) => {
          ws.voiceProduce(sendTransport.id, kind as 'audio' | 'video', rtpParameters);
          callback({ id: 'pending' });
        });
        useVoiceStore.getState().setSendTransport(sendTransport);

        try {
          const savedAudioDevice = localStorage.getItem('ecto-audio-device');
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: savedAudioDevice ? { deviceId: { ideal: savedAudioDevice } } : true,
          });
          const audioTrack = stream.getAudioTracks()[0]!;
          const producer = await sendTransport.produce({ track: audioTrack });
          useVoiceStore.getState().setProducer('audio', producer);
          startSpeakingDetection(stream);
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
      useVoiceStore.getState().setConsumer(consumer.id, consumer);
      ws.voiceConsumerResume(consumer.id);

      if (consumer.kind === 'audio') {
        const audio = document.createElement('audio');
        audio.srcObject = new MediaStream([consumer.track]);
        audio.autoplay = true;
        audio.dataset['consumerId'] = consumer.id;
        document.body.appendChild(audio);
      } else if (consumer.kind === 'video') {
        const userId = d.user_id as string;
        useVoiceStore.getState().setVideoStream(userId, new MediaStream([consumer.track]));
      }
      break;
    }

    case 'voice.producer_closed': {
      const consumerId = [...store.consumers.entries()].find(
        ([, c]) => c.producerId === (d.producerId as string),
      )?.[0];
      if (consumerId) {
        useVoiceStore.getState().removeConsumer(consumerId);
        const audioEl = document.querySelector(`audio[data-consumer-id="${consumerId}"]`);
        audioEl?.remove();
      }
      break;
    }
  }
}
