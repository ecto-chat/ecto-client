import { Device } from 'mediasoup-client';
import { useVoiceStore } from '../stores/voice.js';
import { useAuthStore } from '../stores/auth.js';
import { useServerStore } from '../stores/server.js';
import { connectionManager } from './connection-manager.js';
import { preferenceManager } from './preference-manager.js';
import { startSpeakingDetection } from '../lib/media-utils.js';

// ── Module-level mutable state ──

let speakingCleanup: (() => void) | null = null;
let voiceEventQueue: Promise<void> = Promise.resolve();
let pendingProduceResolve: ((id: string) => void) | null = null;
let pendingProduceReject: ((err: Error) => void) | null = null;
const consumerSpeakingCleanups = new Map<string, () => void>();

/** The original (pre-voice-wrap) ws.onEvent handler. Tracked to prevent stacking on rejoin. */
let voiceOriginalOnEvent: ((event: string, data: unknown, seq: number) => void) | null = null;

// ── Helpers ──

/** Get local user ID — Central account user ID, or server-specific user ID for local accounts */
export function getLocalUserId(): string | undefined {
  const centralUser = useAuthStore.getState().user?.id;
  if (centralUser) return centralUser;
  const serverId = useVoiceStore.getState().currentServerId;
  if (!serverId) return undefined;
  return useServerStore.getState().serverMeta.get(serverId)?.user_id ?? undefined;
}

/** Remove orphaned <audio> elements from previous voice sessions. */
function removeOrphanedAudioElements() {
  document.querySelectorAll('audio[data-consumer-id]').forEach((el) => el.remove());
}

/** Start speaking detection that updates the voice store for a given user. */
function startVoiceSpeakingDetection(stream: MediaStream, userId: string): () => void {
  return startSpeakingDetection(
    stream,
    (speaking) => { useVoiceStore.getState().setSpeaking(userId, speaking); },
    (level) => { useVoiceStore.getState().setAudioLevel(userId, level); },
  );
}

// ── Public API ──

/** Reset module-level voice session state. Called by connection-manager on WS disconnect. */
export function resetVoiceSessionState() {
  speakingCleanup?.();
  speakingCleanup = null;
  for (const cleanup of consumerSpeakingCleanups.values()) cleanup();
  consumerSpeakingCleanups.clear();
  pendingProduceResolve = null;
  pendingProduceReject = null;
  voiceOriginalOnEvent = null;
  removeOrphanedAudioElements();
}

/** Clean up speaking state and session data before leaving a voice channel. */
export function cleanupVoiceSession() {
  speakingCleanup?.();
  speakingCleanup = null;
  for (const cleanup of consumerSpeakingCleanups.values()) cleanup();
  consumerSpeakingCleanups.clear();
  pendingProduceResolve = null;
  pendingProduceReject = null;
}

/** Clean up and restore original WS event handler. */
export function restoreWsHandler(ws: ReturnType<typeof connectionManager.getMainWs>) {
  if (ws && voiceOriginalOnEvent) {
    ws.onEvent = voiceOriginalOnEvent;
    voiceOriginalOnEvent = null;
  }
}

/** Replace the audio producer track with a new device. */
export async function replaceAudioTrack(deviceId: string) {
  const { producers } = useVoiceStore.getState();
  const audioProducer = producers.get('audio');
  if (!audioProducer) return;

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: { exact: deviceId } },
  });
  const newTrack = stream.getAudioTracks()[0]!;
  await audioProducer.replaceTrack({ track: newTrack });

  speakingCleanup?.();
  const localUserId = getLocalUserId();
  if (localUserId) speakingCleanup = startVoiceSpeakingDetection(stream, localUserId);
}

/**
 * Set up voice event handling on the WS connection and join the voice channel.
 * This wires up the event queue that sequences async voice protocol events.
 */
export function setupVoiceEventHandling(ws: NonNullable<ReturnType<typeof connectionManager.getMainWs>>, serverId: string, channelId: string, force?: boolean) {
  useVoiceStore.getState().setChannel(serverId, channelId);
  ws.voiceJoin(channelId, force);

  // Voice events are queued to prevent race conditions between async handlers
  voiceEventQueue = Promise.resolve();
  // Restore original handler before re-wrapping to prevent stacking on rejoin
  if (voiceOriginalOnEvent) {
    ws.onEvent = voiceOriginalOnEvent;
  }
  voiceOriginalOnEvent = ws.onEvent;
  const originalOnEvent = voiceOriginalOnEvent;
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
}

// ── Voice event handler ──

async function handleVoiceEvent(ws: ReturnType<typeof connectionManager.getMainWs>, event: string, data: unknown) {
  if (!ws) return;
  const d = data as Record<string, unknown>;
  const store = useVoiceStore.getState();

  switch (event) {
    case 'voice.error': {
      console.error('[voice] server error:', d.code, d.message);
      speakingCleanup?.();
      speakingCleanup = null;
      for (const cleanup of consumerSpeakingCleanups.values()) cleanup();
      consumerSpeakingCleanups.clear();
      useVoiceStore.getState().cleanup();
      removeOrphanedAudioElements();
      restoreWsHandler(ws);
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
      if (!device) { console.warn('[voice] no device loaded, skipping transport_created'); break; }

      const sendParams = d.send as Record<string, unknown>;
      const recvParams = d.recv as Record<string, unknown>;

      if (sendParams) {
        const sendTransport = device.createSendTransport(sendParams as Parameters<typeof device.createSendTransport>[0]);
        sendTransport.on('connect', ({ dtlsParameters }, callback) => {
          ws.voiceConnectTransport(sendTransport.id, dtlsParameters);
          callback();
        });
        sendTransport.on('connectionstatechange', () => {});
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
        recvTransport.on('connectionstatechange', () => {});
        useVoiceStore.getState().setRecvTransport(recvTransport);
      }
      break;
    }

    case 'voice.new_consumer': {
      const recvTransport = useVoiceStore.getState().recvTransport;
      if (!recvTransport) { console.warn('[voice] no recv transport, skipping consumer'); break; }
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
      const { currentChannelId: targetChannel, currentServerId: targetServer } = useVoiceStore.getState();
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
      speakingCleanup?.();
      speakingCleanup = null;
      for (const cleanup of consumerSpeakingCleanups.values()) cleanup();
      consumerSpeakingCleanups.clear();
      pendingProduceResolve = null;
      pendingProduceReject = null;
      useVoiceStore.getState().cleanup();
      removeOrphanedAudioElements();
      restoreWsHandler(ws);
      break;
    }
  }
}
