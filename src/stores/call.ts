import { create } from 'zustand';
import type { types as mediasoupTypes } from 'mediasoup-client';
import type { CallState, CallEndReason, CallPeerInfo, CallRecord } from 'ecto-shared';

interface CallStore {
  // Call state
  callState: CallState;
  callId: string | null;
  peer: CallPeerInfo | null;
  mediaTypes: ('audio' | 'video')[];
  isInitiator: boolean;
  endReason: CallEndReason | null;
  startedAt: number | null;

  // Peer media state
  peerMuted: boolean;
  peerDeafened: boolean;
  peerVideoEnabled: boolean;
  peerScreenSharing: boolean;

  // Self media state
  selfMuted: boolean;
  selfDeafened: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;

  // mediasoup
  device: mediasoupTypes.Device | null;
  sendTransport: mediasoupTypes.Transport | null;
  recvTransport: mediasoupTypes.Transport | null;
  producers: Map<string, mediasoupTypes.Producer>;
  consumers: Map<string, mediasoupTypes.Consumer>;

  // Streams
  localAudioStream: MediaStream | null;
  localVideoStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  remoteAudioStream: MediaStream | null;
  remoteVideoStream: MediaStream | null;
  remoteScreenStream: MediaStream | null;
  localSpeaking: boolean;
  remoteSpeaking: boolean;

  // Multi-session
  answeredElsewhere: boolean;

  // Call history
  callHistory: CallRecord[];
  historyHasMore: boolean;
  historyFilter: 'all' | 'missed' | 'incoming' | 'outgoing';

  // Actions
  setIncomingCall: (callId: string, peer: CallPeerInfo, mediaTypes: ('audio' | 'video')[]) => void;
  setOutgoingCall: (callId: string, peer: CallPeerInfo, mediaTypes: ('audio' | 'video')[]) => void;
  setAnsweredElsewhere: () => void;
  setConnecting: () => void;
  setActive: () => void;
  setEnded: (reason: CallEndReason) => void;
  setPeerState: (muted: boolean, deafened: boolean, videoEnabled: boolean, screenSharing: boolean) => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleVideo: () => void;
  toggleScreenSharing: () => void;
  setDevice: (device: mediasoupTypes.Device | null) => void;
  setSendTransport: (transport: mediasoupTypes.Transport | null) => void;
  setRecvTransport: (transport: mediasoupTypes.Transport | null) => void;
  setProducer: (kind: string, producer: mediasoupTypes.Producer) => void;
  removeProducer: (kind: string) => void;
  setConsumer: (consumerId: string, consumer: mediasoupTypes.Consumer) => void;
  removeConsumer: (consumerId: string) => void;
  setLocalAudioStream: (stream: MediaStream | null) => void;
  setLocalVideoStream: (stream: MediaStream | null) => void;
  setLocalScreenStream: (stream: MediaStream | null) => void;
  setRemoteAudioStream: (stream: MediaStream | null) => void;
  setRemoteVideoStream: (stream: MediaStream | null) => void;
  setRemoteScreenStream: (stream: MediaStream | null) => void;
  setLocalSpeaking: (speaking: boolean) => void;
  setRemoteSpeaking: (speaking: boolean) => void;
  setCallHistory: (records: CallRecord[], hasMore: boolean) => void;
  appendCallHistory: (records: CallRecord[], hasMore: boolean) => void;
  setHistoryFilter: (filter: 'all' | 'missed' | 'incoming' | 'outgoing') => void;
  removeCallRecord: (recordId: string) => void;
  cleanup: () => void;
}

export const useCallStore = create<CallStore>()((set, get) => ({
  callState: 'idle',
  callId: null,
  peer: null,
  mediaTypes: [],
  isInitiator: false,
  endReason: null,
  startedAt: null,

  peerMuted: false,
  peerDeafened: false,
  peerVideoEnabled: false,
  peerScreenSharing: false,

  selfMuted: false,
  selfDeafened: false,
  videoEnabled: false,
  screenSharing: false,

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

  answeredElsewhere: false,

  callHistory: [],
  historyHasMore: true,
  historyFilter: 'all',

  setIncomingCall: (callId, peer, mediaTypes) =>
    set({
      callState: 'incoming_ringing',
      callId,
      peer,
      mediaTypes,
      isInitiator: false,
      endReason: null,
      answeredElsewhere: false,
    }),

  setOutgoingCall: (callId, peer, mediaTypes) =>
    set({
      callState: 'outgoing_ringing',
      callId,
      peer,
      mediaTypes,
      isInitiator: true,
      endReason: null,
      answeredElsewhere: false,
    }),

  setAnsweredElsewhere: () => set({ answeredElsewhere: true }),

  setConnecting: () => set({ callState: 'connecting' }),

  setActive: () => set({ callState: 'active', startedAt: Date.now() }),

  setEnded: (reason) => set({ callState: 'ended', endReason: reason }),

  setPeerState: (muted, deafened, videoEnabled, screenSharing) =>
    set({ peerMuted: muted, peerDeafened: deafened, peerVideoEnabled: videoEnabled, peerScreenSharing: screenSharing }),

  toggleMute: () =>
    set((state) => ({ selfMuted: !state.selfMuted })),

  toggleDeafen: () =>
    set((state) => ({
      selfDeafened: !state.selfDeafened,
      selfMuted: !state.selfDeafened ? true : state.selfMuted,
    })),

  toggleVideo: () =>
    set((state) => ({ videoEnabled: !state.videoEnabled })),

  toggleScreenSharing: () =>
    set((state) => ({ screenSharing: !state.screenSharing })),

  setDevice: (device) => set({ device }),
  setSendTransport: (transport) => set({ sendTransport: transport }),
  setRecvTransport: (transport) => set({ recvTransport: transport }),

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

  setConsumer: (consumerId, consumer) =>
    set((state) => {
      const consumers = new Map(state.consumers);
      consumers.set(consumerId, consumer);
      return { consumers };
    }),

  removeConsumer: (consumerId) =>
    set((state) => {
      const consumers = new Map(state.consumers);
      const consumer = consumers.get(consumerId);
      consumer?.close();
      consumers.delete(consumerId);
      return { consumers };
    }),

  setLocalAudioStream: (stream) => set({ localAudioStream: stream }),
  setLocalVideoStream: (stream) => set({ localVideoStream: stream }),
  setLocalScreenStream: (stream) => set({ localScreenStream: stream }),
  setRemoteAudioStream: (stream) => set({ remoteAudioStream: stream }),
  setRemoteVideoStream: (stream) => set({ remoteVideoStream: stream }),
  setRemoteScreenStream: (stream) => set({ remoteScreenStream: stream }),
  setLocalSpeaking: (speaking) => set({ localSpeaking: speaking }),
  setRemoteSpeaking: (speaking) => set({ remoteSpeaking: speaking }),

  setCallHistory: (records, hasMore) =>
    set({ callHistory: records, historyHasMore: hasMore }),

  appendCallHistory: (records, hasMore) =>
    set((state) => ({
      callHistory: [...state.callHistory, ...records],
      historyHasMore: hasMore,
    })),

  setHistoryFilter: (filter) => set({ historyFilter: filter }),

  removeCallRecord: (recordId) =>
    set((state) => ({
      callHistory: state.callHistory.filter((r) => r.id !== recordId),
    })),

  cleanup: () => {
    const state = get();
    state.sendTransport?.close();
    state.recvTransport?.close();
    for (const producer of state.producers.values()) producer.close();
    for (const consumer of state.consumers.values()) consumer.close();

    // Stop local streams
    state.localAudioStream?.getTracks().forEach((t) => t.stop());
    state.localVideoStream?.getTracks().forEach((t) => t.stop());
    state.localScreenStream?.getTracks().forEach((t) => t.stop());

    set({
      callState: 'idle',
      callId: null,
      peer: null,
      mediaTypes: [],
      isInitiator: false,
      endReason: null,
      startedAt: null,
      peerMuted: false,
      peerDeafened: false,
      peerVideoEnabled: false,
      peerScreenSharing: false,
      selfMuted: false,
      selfDeafened: false,
      videoEnabled: false,
      screenSharing: false,
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
      answeredElsewhere: false,
    });
  },
}));
