import { create } from 'zustand';
import type { Message } from 'ecto-shared';

interface MessageStore {
  // channelId → messageId → Message
  messages: Map<string, Map<string, Message>>;
  // channelId → ordered message IDs (oldest first)
  messageOrder: Map<string, string[]>;
  // channelId → oldest loaded message ID
  oldestLoaded: Map<string, string>;
  // channelId → has more messages to load
  hasMore: Map<string, boolean>;
  // channelId → userId → timestamp of last typing event
  typingUsers: Map<string, Map<string, number>>;
  // Nonces of optimistic messages sent by this client (for WS echo suppression)
  pendingNonces: Set<string>;
  // Stable React keys for optimistic messages (realId → tempId)
  stableKeys: Map<string, string>;

  addMessage: (channelId: string, message: Message) => void;
  prependMessages: (channelId: string, messages: Message[], hasMore: boolean) => void;
  updateMessage: (channelId: string, update: { id: string; content?: string; edited_at?: string; pinned?: boolean }) => void;
  deleteMessage: (channelId: string, messageId: string) => void;
  updateReaction: (channelId: string, messageId: string, emoji: string, userId: string, action: 'add' | 'remove', count: number) => void;
  replaceMessage: (channelId: string, tempId: string, real: Message) => void;
  clearChannel: (channelId: string) => void;
  setTyping: (channelId: string, userId: string) => void;
  clearTyping: (channelId: string, userId: string) => void;
  clearExpiredTyping: () => void;
  addNonce: (nonce: string) => void;
  consumeNonce: (nonce: string) => boolean;
}

export const useMessageStore = create<MessageStore>()((set, get) => ({
  messages: new Map(),
  messageOrder: new Map(),
  oldestLoaded: new Map(),
  hasMore: new Map(),
  typingUsers: new Map(),
  pendingNonces: new Set(),
  stableKeys: new Map(),

  addMessage: (channelId, message) =>
    set((state) => {
      const messages = new Map(state.messages);
      const messageOrder = new Map(state.messageOrder);
      const channelMessages = new Map(messages.get(channelId) ?? new Map());
      const alreadyExists = channelMessages.has(message.id);
      channelMessages.set(message.id, message);
      messages.set(channelId, channelMessages);
      // Only append to order if this is a genuinely new message
      if (!alreadyExists) {
        const order = [...(messageOrder.get(channelId) ?? []), message.id];
        messageOrder.set(channelId, order);
      }
      return { messages, messageOrder };
    }),

  prependMessages: (channelId, newMessages, hasMoreFlag) =>
    set((state) => {
      const messages = new Map(state.messages);
      const messageOrder = new Map(state.messageOrder);
      const oldestLoaded = new Map(state.oldestLoaded);
      const hasMore = new Map(state.hasMore);

      const channelMessages = new Map(messages.get(channelId) ?? new Map());
      const newIds: string[] = [];
      for (const msg of newMessages) {
        channelMessages.set(msg.id, msg);
        newIds.push(msg.id);
      }
      messages.set(channelId, channelMessages);

      const existing = messageOrder.get(channelId) ?? [];
      // Deduplicate: only prepend IDs not already in the order
      const existingSet = new Set(existing);
      const uniqueNewIds = newIds.filter((id) => !existingSet.has(id));
      messageOrder.set(channelId, [...uniqueNewIds, ...existing]);

      if (newMessages.length > 0) {
        oldestLoaded.set(channelId, newMessages[0]!.id);
      }
      hasMore.set(channelId, hasMoreFlag);
      return { messages, messageOrder, oldestLoaded, hasMore };
    }),

  updateMessage: (channelId, update) =>
    set((state) => {
      const existing = state.messages.get(channelId)?.get(update.id);
      if (!existing) return state;
      const messages = new Map(state.messages);
      const channelMessages = new Map(messages.get(channelId)!);
      channelMessages.set(update.id, { ...existing, ...update });
      messages.set(channelId, channelMessages);
      return { messages };
    }),

  deleteMessage: (channelId, messageId) =>
    set((state) => {
      const messages = new Map(state.messages);
      const messageOrder = new Map(state.messageOrder);
      const channelMessages = new Map(messages.get(channelId) ?? new Map());
      channelMessages.delete(messageId);
      messages.set(channelId, channelMessages);
      messageOrder.set(
        channelId,
        (messageOrder.get(channelId) ?? []).filter((id) => id !== messageId),
      );
      return { messages, messageOrder };
    }),

  updateReaction: (channelId, messageId, emoji, userId, action, count) =>
    set((state) => {
      const existing = state.messages.get(channelId)?.get(messageId);
      if (!existing) return state;
      const messages = new Map(state.messages);
      const channelMessages = new Map(messages.get(channelId)!);

      const reactions = [...existing.reactions];
      const idx = reactions.findIndex((r) => r.emoji === emoji);
      if (idx >= 0) {
        const reaction = reactions[idx]!;
        const users =
          action === 'add'
            ? [...reaction.users, userId]
            : reaction.users.filter((u) => u !== userId);
        if (count === 0) {
          reactions.splice(idx, 1);
        } else {
          reactions[idx] = { ...reaction, count, users, me: users.includes(userId) };
        }
      } else if (action === 'add') {
        reactions.push({ emoji, count, users: [userId], me: true });
      }

      channelMessages.set(messageId, { ...existing, reactions });
      messages.set(channelId, channelMessages);
      return { messages };
    }),

  replaceMessage: (channelId, tempId, real) =>
    set((state) => {
      const channelMessages = state.messages.get(channelId);
      if (!channelMessages?.has(tempId)) return state;
      const messages = new Map(state.messages);
      const messageOrder = new Map(state.messageOrder);
      const stableKeys = new Map(state.stableKeys);
      const updated = new Map(channelMessages);
      updated.delete(tempId);
      updated.set(real.id, real);
      messages.set(channelId, updated);
      const order = messageOrder.get(channelId) ?? [];
      if (order.includes(real.id)) {
        // WS echo arrived first — real ID already in order, just remove temp
        messageOrder.set(channelId, order.filter((id) => id !== tempId));
      } else {
        messageOrder.set(channelId, order.map((id) => (id === tempId ? real.id : id)));
      }
      // Carry the stable key so React doesn't unmount/remount the message
      stableKeys.set(real.id, tempId);
      stableKeys.delete(tempId);
      return { messages, messageOrder, stableKeys };
    }),

  clearChannel: (channelId) =>
    set((state) => {
      const messages = new Map(state.messages);
      const messageOrder = new Map(state.messageOrder);
      const oldestLoaded = new Map(state.oldestLoaded);
      const hasMore = new Map(state.hasMore);
      messages.delete(channelId);
      messageOrder.delete(channelId);
      oldestLoaded.delete(channelId);
      hasMore.delete(channelId);
      return { messages, messageOrder, oldestLoaded, hasMore };
    }),

  setTyping: (channelId, userId) =>
    set((state) => {
      const typingUsers = new Map(state.typingUsers);
      const channelTyping = new Map(typingUsers.get(channelId) ?? new Map());
      channelTyping.set(userId, Date.now());
      typingUsers.set(channelId, channelTyping);
      return { typingUsers };
    }),

  clearTyping: (channelId, userId) =>
    set((state) => {
      const channelTyping = state.typingUsers.get(channelId);
      if (!channelTyping?.has(userId)) return state;
      const typingUsers = new Map(state.typingUsers);
      const updated = new Map(channelTyping);
      updated.delete(userId);
      typingUsers.set(channelId, updated);
      return { typingUsers };
    }),

  clearExpiredTyping: () =>
    set((state) => {
      const now = Date.now();
      const typingUsers = new Map(state.typingUsers);
      let changed = false;
      for (const [channelId, users] of typingUsers) {
        const updated = new Map(users);
        for (const [userId, ts] of updated) {
          if (now - ts > 8000) {
            updated.delete(userId);
            changed = true;
          }
        }
        typingUsers.set(channelId, updated);
      }
      return changed ? { typingUsers } : state;
    }),

  addNonce: (nonce) => {
    get().pendingNonces.add(nonce);
  },

  consumeNonce: (nonce) => {
    const removed = get().pendingNonces.delete(nonce);
    return removed;
  },
}));
