import { create } from 'zustand';
import type { ServerDmConversation, ServerDmMessage, ReactionGroup } from 'ecto-shared';

interface ServerDmStore {
  /** Conversation ID → conversation */
  conversations: Map<string, ServerDmConversation>;
  /** Conversation ID → message ID → message */
  messages: Map<string, Map<string, ServerDmMessage>>;
  /** Conversation ID → ordered message IDs */
  messageOrder: Map<string, string[]>;
  activeConversationId: string | null;
  /** Conversation ID → typing timestamp */
  typingPeers: Map<string, number>;
  /** Server ID → total unread DM count (persists across server switches) */
  serverDmUnreads: Map<string, number>;
  /** Conversation ID → unread count (separate from conversations to avoid state conflicts) */
  conversationUnreads: Map<string, number>;

  setConversations: (convos: ServerDmConversation[]) => void;
  addMessage: (convoId: string, message: ServerDmMessage) => void;
  prependMessages: (convoId: string, messages: ServerDmMessage[]) => void;
  deleteMessage: (convoId: string, messageId: string) => void;
  updateMessage: (convoId: string, messageId: string, updates: Partial<ServerDmMessage>) => void;
  updateReactions: (convoId: string, messageId: string, reactions: ReactionGroup[]) => void;
  updateReaction: (
    convoId: string,
    messageId: string,
    emoji: string,
    userId: string,
    action: 'add' | 'remove',
    count: number,
  ) => void;
  setActiveConversation: (convoId: string | null) => void;
  setTyping: (convoId: string) => void;
  clearExpiredTyping: () => void;
  ensureConversation: (convo: ServerDmConversation) => void;
  incrementUnread: (serverId: string, convoId: string) => void;
  markConversationRead: (serverId: string, convoId: string) => void;
  /** Hydrate unread counts from server data (called after list query) */
  hydrateUnreads: (serverId: string, convos: ServerDmConversation[]) => void;
  clear: () => void;
}

export const useServerDmStore = create<ServerDmStore>()((set) => ({
  conversations: new Map(),
  messages: new Map(),
  messageOrder: new Map(),
  activeConversationId: null,
  typingPeers: new Map(),
  serverDmUnreads: new Map(),
  conversationUnreads: new Map(),

  setConversations: (convos) => {
    const conversations = new Map<string, ServerDmConversation>();
    for (const c of convos) conversations.set(c.id, c);
    set({ conversations });
  },

  addMessage: (convoId, message) =>
    set((state) => {
      const messages = new Map(state.messages);
      const messageOrder = new Map(state.messageOrder);
      const convoMessages = new Map(messages.get(convoId) ?? new Map());
      const alreadyExists = convoMessages.has(message.id);
      convoMessages.set(message.id, message);
      messages.set(convoId, convoMessages);

      if (!alreadyExists) {
        const order = [...(messageOrder.get(convoId) ?? []), message.id];
        messageOrder.set(convoId, order);
      }

      // Update last_message on conversation
      const conversations = new Map(state.conversations);
      const conv = conversations.get(convoId);
      if (conv) {
        conversations.set(convoId, { ...conv, last_message: message });
      }

      return { messages, messageOrder, conversations };
    }),

  prependMessages: (convoId, newMessages) =>
    set((state) => {
      const messages = new Map(state.messages);
      const messageOrder = new Map(state.messageOrder);
      const convoMessages = new Map(messages.get(convoId) ?? new Map());
      const existing = messageOrder.get(convoId) ?? [];
      const existingSet = new Set(existing);
      const newIds: string[] = [];
      for (const msg of newMessages) {
        convoMessages.set(msg.id, msg);
        if (!existingSet.has(msg.id)) newIds.push(msg.id);
      }
      messages.set(convoId, convoMessages);
      messageOrder.set(convoId, [...newIds, ...existing]);
      return { messages, messageOrder };
    }),

  deleteMessage: (convoId, messageId) =>
    set((state) => {
      const convoMessages = state.messages.get(convoId);
      if (!convoMessages?.has(messageId)) return state;
      const messages = new Map(state.messages);
      const messageOrder = new Map(state.messageOrder);
      const updated = new Map(convoMessages);
      updated.delete(messageId);
      messages.set(convoId, updated);
      messageOrder.set(
        convoId,
        (messageOrder.get(convoId) ?? []).filter((id) => id !== messageId),
      );
      return { messages, messageOrder };
    }),

  updateMessage: (convoId, messageId, updates) =>
    set((state) => {
      const convoMessages = state.messages.get(convoId);
      const msg = convoMessages?.get(messageId);
      if (!msg) return state;
      const messages = new Map(state.messages);
      const updated = new Map(convoMessages);
      updated.set(messageId, { ...msg, ...updates });
      messages.set(convoId, updated);
      return { messages };
    }),

  updateReactions: (convoId, messageId, reactions) =>
    set((state) => {
      const convoMessages = state.messages.get(convoId);
      const msg = convoMessages?.get(messageId);
      if (!msg) return state;
      const messages = new Map(state.messages);
      const updated = new Map(convoMessages);
      updated.set(messageId, { ...msg, reactions });
      messages.set(convoId, updated);
      return { messages };
    }),

  updateReaction: (convoId, messageId, emoji, userId, action, count) =>
    set((state) => {
      const convoMessages = state.messages.get(convoId);
      const msg = convoMessages?.get(messageId);
      if (!msg) return state;

      let reactions = [...msg.reactions];
      const existing = reactions.findIndex((r) => r.emoji === emoji);

      if (action === 'add') {
        if (existing >= 0) {
          const r = reactions[existing]!;
          reactions[existing] = {
            ...r,
            count,
            users: r.users.includes(userId) ? r.users : [...r.users, userId],
            me: r.me || userId === userId,
          };
        } else {
          reactions.push({ emoji, count, users: [userId], me: true });
        }
      } else {
        if (existing >= 0) {
          if (count === 0) {
            reactions = reactions.filter((r) => r.emoji !== emoji);
          } else {
            const r = reactions[existing]!;
            reactions[existing] = {
              ...r,
              count,
              users: r.users.filter((u) => u !== userId),
              me: r.me && userId !== userId,
            };
          }
        }
      }

      const messages = new Map(state.messages);
      const updated = new Map(convoMessages);
      updated.set(messageId, { ...msg, reactions });
      messages.set(convoId, updated);
      return { messages };
    }),

  setActiveConversation: (convoId) => set({ activeConversationId: convoId }),

  setTyping: (convoId) =>
    set((state) => {
      const typingPeers = new Map(state.typingPeers);
      typingPeers.set(convoId, Date.now());
      return { typingPeers };
    }),

  clearExpiredTyping: () =>
    set((state) => {
      const now = Date.now();
      const typingPeers = new Map(state.typingPeers);
      let changed = false;
      for (const [convoId, ts] of typingPeers) {
        if (now - ts > 8000) {
          typingPeers.delete(convoId);
          changed = true;
        }
      }
      return changed ? { typingPeers } : state;
    }),

  ensureConversation: (convo) =>
    set((state) => {
      const conversations = new Map(state.conversations);
      const existing = conversations.get(convo.id);
      if (!existing) {
        conversations.set(convo.id, convo);
      }
      return { conversations };
    }),

  incrementUnread: (serverId, convoId) =>
    set((state) => {
      const serverDmUnreads = new Map(state.serverDmUnreads);
      serverDmUnreads.set(serverId, (serverDmUnreads.get(serverId) ?? 0) + 1);
      const conversationUnreads = new Map(state.conversationUnreads);
      conversationUnreads.set(convoId, (conversationUnreads.get(convoId) ?? 0) + 1);
      return { serverDmUnreads, conversationUnreads };
    }),

  markConversationRead: (serverId, convoId) =>
    set((state) => {
      const count = state.conversationUnreads.get(convoId) ?? 0;
      if (count === 0) return state;
      const serverDmUnreads = new Map(state.serverDmUnreads);
      const current = serverDmUnreads.get(serverId) ?? 0;
      serverDmUnreads.set(serverId, Math.max(0, current - count));
      const conversationUnreads = new Map(state.conversationUnreads);
      conversationUnreads.delete(convoId);
      return { serverDmUnreads, conversationUnreads };
    }),

  hydrateUnreads: (serverId, convos) =>
    set((state) => {
      const serverDmUnreads = new Map(state.serverDmUnreads);
      const conversationUnreads = new Map(state.conversationUnreads);
      let serverTotal = 0;
      for (const c of convos) {
        if (c.unread_count > 0) {
          // Only set if we don't already have a higher client-side count
          // (messages may have arrived while we were fetching the list)
          const existing = conversationUnreads.get(c.id) ?? 0;
          if (c.unread_count > existing) {
            conversationUnreads.set(c.id, c.unread_count);
          }
        }
        serverTotal += conversationUnreads.get(c.id) ?? c.unread_count;
      }
      serverDmUnreads.set(serverId, serverTotal);
      return { serverDmUnreads, conversationUnreads };
    }),

  clear: () =>
    set((state) => ({
      conversations: new Map(),
      messages: new Map(),
      messageOrder: new Map(),
      activeConversationId: null,
      typingPeers: new Map(),
      // Preserve unread tracking across clears (persists across server switches)
      serverDmUnreads: state.serverDmUnreads,
      conversationUnreads: state.conversationUnreads,
    })),
}));
