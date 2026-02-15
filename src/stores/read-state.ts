import { create } from 'zustand';

interface ReadStateStore {
  // channelId → last read message ID
  lastRead: Map<string, string>;
  // channelId → unread count
  unreadCounts: Map<string, number>;
  // channelId → mention count
  mentionCounts: Map<string, number>;

  markRead: (channelId: string, messageId: string) => void;
  incrementUnread: (channelId: string) => void;
  incrementMention: (channelId: string) => void;
  setReadState: (channelId: string, lastReadId: string, mentionCount: number) => void;
  bulkSetReadState: (states: { channel_id: string; last_read_message_id: string; mention_count: number }[]) => void;
  markAllRead: (channelIds: string[]) => void;
}

export const useReadStateStore = create<ReadStateStore>()((set) => ({
  lastRead: new Map(),
  unreadCounts: new Map(),
  mentionCounts: new Map(),

  markRead: (channelId, messageId) =>
    set((state) => {
      const lastRead = new Map(state.lastRead);
      const unreadCounts = new Map(state.unreadCounts);
      const mentionCounts = new Map(state.mentionCounts);
      lastRead.set(channelId, messageId);
      unreadCounts.set(channelId, 0);
      mentionCounts.set(channelId, 0);
      return { lastRead, unreadCounts, mentionCounts };
    }),

  incrementUnread: (channelId) =>
    set((state) => {
      const unreadCounts = new Map(state.unreadCounts);
      unreadCounts.set(channelId, (unreadCounts.get(channelId) ?? 0) + 1);
      return { unreadCounts };
    }),

  incrementMention: (channelId) =>
    set((state) => {
      const mentionCounts = new Map(state.mentionCounts);
      mentionCounts.set(channelId, (mentionCounts.get(channelId) ?? 0) + 1);
      return { mentionCounts };
    }),

  setReadState: (channelId, lastReadId, mentionCount) =>
    set((state) => {
      const lastRead = new Map(state.lastRead);
      const mentionCounts = new Map(state.mentionCounts);
      lastRead.set(channelId, lastReadId);
      mentionCounts.set(channelId, mentionCount);
      return { lastRead, mentionCounts };
    }),

  bulkSetReadState: (states) =>
    set((prev) => {
      const lastRead = new Map(prev.lastRead);
      const mentionCounts = new Map(prev.mentionCounts);
      for (const s of states) {
        lastRead.set(s.channel_id, s.last_read_message_id);
        mentionCounts.set(s.channel_id, s.mention_count);
      }
      return { lastRead, mentionCounts };
    }),

  markAllRead: (channelIds) =>
    set((prev) => {
      const unreadCounts = new Map(prev.unreadCounts);
      const mentionCounts = new Map(prev.mentionCounts);
      for (const id of channelIds) {
        unreadCounts.set(id, 0);
        mentionCounts.set(id, 0);
      }
      return { unreadCounts, mentionCounts };
    }),
}));
