import { create } from 'zustand';
import type { DMConversation, DirectMessage, ReactionGroup } from 'ecto-shared';

interface DmStore {
  conversations: Map<string, DMConversation>;
  // userId → messageId → DirectMessage
  messages: Map<string, Map<string, DirectMessage>>;
  messageOrder: Map<string, string[]>;
  openConversationId: string | null;
  typingUsers: Map<string, number>;

  setConversations: (conversations: DMConversation[]) => void;
  addMessage: (userId: string, message: DirectMessage) => void;
  prependMessages: (userId: string, messages: DirectMessage[]) => void;
  openConversation: (userId: string) => void;
  closeConversation: () => void;
  setTyping: (userId: string) => void;
  clearExpiredTyping: () => void;
  deleteMessage: (peerId: string, messageId: string) => void;
  updateMessage: (peerId: string, messageId: string, updates: Partial<DirectMessage>) => void;
  updateReactions: (peerId: string, messageId: string, reactions: ReactionGroup[]) => void;
  ensureConversation: (userId: string, message: DirectMessage) => void;
  updateConversation: (userId: string, updates: Partial<DMConversation>) => void;
}

export const useDmStore = create<DmStore>()((set) => ({
  conversations: new Map(),
  messages: new Map(),
  messageOrder: new Map(),
  openConversationId: null,
  typingUsers: new Map(),

  setConversations: (convList) => {
    const conversations = new Map<string, DMConversation>();
    for (const c of convList) conversations.set(c.user_id, c);
    set({ conversations });
  },

  addMessage: (userId, message) =>
    set((state) => {
      const messages = new Map(state.messages);
      const messageOrder = new Map(state.messageOrder);
      const userMessages = new Map(messages.get(userId) ?? new Map());
      const alreadyExists = userMessages.has(message.id);
      userMessages.set(message.id, message);
      messages.set(userId, userMessages);

      // Only append to order if genuinely new
      if (!alreadyExists) {
        const order = [...(messageOrder.get(userId) ?? []), message.id];
        messageOrder.set(userId, order);
      }

      // Update conversation last_message
      const conversations = new Map(state.conversations);
      const conv = conversations.get(userId);
      if (conv) {
        conversations.set(userId, { ...conv, last_message: message });
      }

      return { messages, messageOrder, conversations };
    }),

  prependMessages: (userId, newMessages) =>
    set((state) => {
      const messages = new Map(state.messages);
      const messageOrder = new Map(state.messageOrder);
      const userMessages = new Map(messages.get(userId) ?? new Map());
      const existing = messageOrder.get(userId) ?? [];
      const existingSet = new Set(existing);
      const newIds: string[] = [];
      for (const msg of newMessages) {
        userMessages.set(msg.id, msg);
        if (!existingSet.has(msg.id)) newIds.push(msg.id);
      }
      messages.set(userId, userMessages);
      // History API returns newest-first; reverse to chronological (oldest first)
      newIds.reverse();
      messageOrder.set(userId, [...newIds, ...existing]);
      return { messages, messageOrder };
    }),

  openConversation: (userId) => set({ openConversationId: userId }),
  closeConversation: () => set({ openConversationId: null }),

  setTyping: (userId) =>
    set((state) => {
      const typingUsers = new Map(state.typingUsers);
      typingUsers.set(userId, Date.now());
      return { typingUsers };
    }),

  clearExpiredTyping: () =>
    set((state) => {
      const now = Date.now();
      const typingUsers = new Map(state.typingUsers);
      let changed = false;
      for (const [userId, ts] of typingUsers) {
        if (now - ts > 8000) {
          typingUsers.delete(userId);
          changed = true;
        }
      }
      return changed ? { typingUsers } : state;
    }),

  deleteMessage: (peerId, messageId) =>
    set((state) => {
      const userMessages = state.messages.get(peerId);
      if (!userMessages?.has(messageId)) return state;
      const messages = new Map(state.messages);
      const messageOrder = new Map(state.messageOrder);
      const updated = new Map(userMessages);
      updated.delete(messageId);
      messages.set(peerId, updated);
      messageOrder.set(
        peerId,
        (messageOrder.get(peerId) ?? []).filter((id) => id !== messageId),
      );
      return { messages, messageOrder };
    }),

  updateMessage: (peerId, messageId, updates) =>
    set((state) => {
      const userMessages = state.messages.get(peerId);
      const msg = userMessages?.get(messageId);
      if (!msg) return state;
      const messages = new Map(state.messages);
      const updated = new Map(userMessages);
      updated.set(messageId, { ...msg, ...updates });
      messages.set(peerId, updated);
      return { messages };
    }),

  updateReactions: (peerId, messageId, reactions) =>
    set((state) => {
      const userMessages = state.messages.get(peerId);
      const msg = userMessages?.get(messageId);
      if (!msg) return state;
      const messages = new Map(state.messages);
      const updated = new Map(userMessages);
      updated.set(messageId, { ...msg, reactions });
      messages.set(peerId, updated);
      return { messages };
    }),

  ensureConversation: (userId, message) =>
    set((state) => {
      const conversations = new Map(state.conversations);
      const existing = conversations.get(userId);
      if (existing) {
        // Update last_message if this message is newer
        if (!existing.last_message || message.created_at >= existing.last_message.created_at) {
          conversations.set(userId, { ...existing, last_message: message });
        }
      } else {
        // Create a new conversation entry from the message sender info
        const sender = message.sender;
        conversations.set(userId, {
          user_id: userId,
          username: sender.username,
          discriminator: '',
          display_name: sender.display_name,
          avatar_url: sender.avatar_url,
          last_message: message,
          unread_count: 0,
        });
      }
      return { conversations };
    }),

  updateConversation: (userId, updates) =>
    set((state) => {
      const existing = state.conversations.get(userId);
      if (!existing) return state;
      const conversations = new Map(state.conversations);
      conversations.set(userId, { ...existing, ...updates });
      return { conversations };
    }),
}));
