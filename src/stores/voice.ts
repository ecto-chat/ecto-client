import { create } from 'zustand';
import type { VoiceState } from 'ecto-shared';
import type { types as mediasoupTypes } from 'mediasoup-client';

type VoiceStatus = 'disconnected' | 'connecting' | 'connected';

interface VoiceStore {
  currentChannelId: string | null;
  currentServerId: string | null;
  voiceStatus: VoiceStatus;
  selfMuted: boolean;
  selfDeafened: boolean;
  pttEnabled: boolean;
  pttKey: string;
  pttActive: boolean;
  speaking: Set<string>;
  audioLevels: Map<string, number>;
  participants: Map<string, VoiceState>;
  videoStreams: Map<string, MediaStream>;
  screenStreams: Map<string, MediaStream>;
  producers: Map<string, mediasoupTypes.Producer>;
  consumers: Map<string, mediasoupTypes.Consumer>;
  consumerMeta: Map<string, { userId: string; source: string }>;
  sendTransport: mediasoupTypes.Transport | null;
  recvTransport: mediasoupTypes.Transport | null;
  device: mediasoupTypes.Device | null;

  pendingTransfer: {
    serverId: string;
    channelId: string;
    currentChannelId: string;
    sameSession: boolean;
  } | null;

  setPttEnabled: (enabled: boolean) => void;
  setPttKey: (key: string) => void;
  setPttActive: (active: boolean) => void;
  setPendingTransfer: (transfer: VoiceStore['pendingTransfer']) => void;
  setChannel: (serverId: string, channelId: string) => void;
  setVoiceStatus: (status: VoiceStatus) => void;
  leaveChannel: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  setSpeaking: (userId: string, isSpeaking: boolean) => void;
  setAudioLevel: (userId: string, level: number) => void;
  addParticipant: (state: VoiceState) => void;
  removeParticipant: (userId: string) => void;
  updateParticipant: (state: VoiceState) => void;
  setVideoStream: (userId: string, stream: MediaStream | null) => void;
  setScreenStream: (userId: string, stream: MediaStream | null) => void;
  setProducer: (kind: string, producer: mediasoupTypes.Producer) => void;
  removeProducer: (kind: string) => void;
  setConsumer: (consumerId: string, consumer: mediasoupTypes.Consumer, meta?: { userId: string; source: string }) => void;
  removeConsumer: (consumerId: string) => void;
  setSendTransport: (transport: mediasoupTypes.Transport | null) => void;
  setRecvTransport: (transport: mediasoupTypes.Transport | null) => void;
  setDevice: (device: mediasoupTypes.Device | null) => void;
  cleanup: () => void;
}

export const useVoiceStore = create<VoiceStore>()((set, get) => ({
  currentChannelId: null,
  currentServerId: null,
  voiceStatus: 'disconnected',
  selfMuted: false,
  selfDeafened: false,
  pttEnabled: localStorage.getItem('ecto-ptt-enabled') === 'true',
  pttKey: localStorage.getItem('ecto-ptt-key') ?? ' ',
  pttActive: false,
  speaking: new Set(),
  audioLevels: new Map(),
  participants: new Map(),
  videoStreams: new Map(),
  screenStreams: new Map(),
  producers: new Map(),
  consumers: new Map(),
  consumerMeta: new Map(),
  sendTransport: null,
  recvTransport: null,
  device: null,
  pendingTransfer: null,

  setPttEnabled: (enabled) => {
    localStorage.setItem('ecto-ptt-enabled', String(enabled));
    set({ pttEnabled: enabled });
  },
  setPttKey: (key) => {
    localStorage.setItem('ecto-ptt-key', key);
    set({ pttKey: key });
  },
  setPttActive: (active) => set({ pttActive: active }),
  setPendingTransfer: (transfer) => set({ pendingTransfer: transfer }),
  setChannel: (serverId, channelId) =>
    set({ currentServerId: serverId, currentChannelId: channelId, voiceStatus: 'connecting' }),

  setVoiceStatus: (status) => set({ voiceStatus: status }),

  leaveChannel: () =>
    set({
      currentChannelId: null,
      currentServerId: null,
      voiceStatus: 'disconnected',
      selfMuted: false,
      selfDeafened: false,
      speaking: new Set(),
      audioLevels: new Map(),
      participants: new Map(),
      pendingTransfer: null,
    }),

  toggleMute: () => set((state) => ({ selfMuted: !state.selfMuted })),
  toggleDeafen: () =>
    set((state) => ({
      selfDeafened: !state.selfDeafened,
      selfMuted: !state.selfDeafened ? true : state.selfMuted,
    })),

  setSpeaking: (userId, isSpeaking) =>
    set((state) => {
      const speaking = new Set(state.speaking);
      if (isSpeaking) speaking.add(userId);
      else speaking.delete(userId);
      // Clear audio level when not speaking
      if (!isSpeaking) {
        const audioLevels = new Map(state.audioLevels);
        audioLevels.delete(userId);
        return { speaking, audioLevels };
      }
      return { speaking };
    }),

  setAudioLevel: (userId, level) =>
    set((state) => {
      const audioLevels = new Map(state.audioLevels);
      audioLevels.set(userId, level);
      return { audioLevels };
    }),

  addParticipant: (voiceState) =>
    set((state) => {
      const participants = new Map(state.participants);
      participants.set(voiceState.user_id, voiceState);
      return { participants };
    }),

  removeParticipant: (userId) =>
    set((state) => {
      const participants = new Map(state.participants);
      participants.delete(userId);
      const speaking = new Set(state.speaking);
      speaking.delete(userId);
      return { participants, speaking };
    }),

  updateParticipant: (voiceState) =>
    set((state) => {
      const participants = new Map(state.participants);
      participants.set(voiceState.user_id, voiceState);
      return { participants };
    }),

  setVideoStream: (userId, stream) =>
    set((state) => {
      const videoStreams = new Map(state.videoStreams);
      if (stream) videoStreams.set(userId, stream);
      else videoStreams.delete(userId);
      return { videoStreams };
    }),

  setScreenStream: (userId, stream) =>
    set((state) => {
      const screenStreams = new Map(state.screenStreams);
      if (stream) screenStreams.set(userId, stream);
      else screenStreams.delete(userId);
      return { screenStreams };
    }),

  setProducer: (kind, producer) =>
    set((state) => {
      const producers = new Map(state.producers);
      producers.set(kind, producer);
      return { producers };
    }),

  removeProducer: (kind) =>
    set((state) => {
      const producers = new Map(state.producers);
      const producer = producers.get(kind);
      producer?.close();
      producers.delete(kind);
      return { producers };
    }),

  setConsumer: (consumerId, consumer, meta) =>
    set((state) => {
      const consumers = new Map(state.consumers);
      consumers.set(consumerId, consumer);
      const consumerMeta = new Map(state.consumerMeta);
      if (meta) consumerMeta.set(consumerId, meta);
      return { consumers, consumerMeta };
    }),

  removeConsumer: (consumerId) =>
    set((state) => {
      const consumers = new Map(state.consumers);
      const consumer = consumers.get(consumerId);
      consumer?.close();
      consumers.delete(consumerId);
      const consumerMeta = new Map(state.consumerMeta);
      consumerMeta.delete(consumerId);
      return { consumers, consumerMeta };
    }),

  setSendTransport: (transport) => set({ sendTransport: transport }),
  setRecvTransport: (transport) => set({ recvTransport: transport }),
  setDevice: (device) => set({ device }),

  cleanup: () => {
    const state = get();
    state.sendTransport?.close();
    state.recvTransport?.close();
    for (const producer of state.producers.values()) producer.close();
    for (const consumer of state.consumers.values()) consumer.close();
    set({
      currentChannelId: null,
      currentServerId: null,
      voiceStatus: 'disconnected',
      selfMuted: false,
      selfDeafened: false,
      speaking: new Set(),
      audioLevels: new Map(),
      participants: new Map(),
      videoStreams: new Map(),
      screenStreams: new Map(),
      producers: new Map(),
      consumers: new Map(),
      consumerMeta: new Map(),
      sendTransport: null,
      recvTransport: null,
      pendingTransfer: null,
    });
  },
}));
