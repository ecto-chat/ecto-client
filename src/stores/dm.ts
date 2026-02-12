import { create } from 'zustand';
import type { DMConversation, DirectMessage } from 'ecto-shared';

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
      userMessages.set(message.id, message);
      messages.set(userId, userMessages);
      const order = [...(messageOrder.get(userId) ?? []), message.id];
      messageOrder.set(userId, order);

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
      const newIds: string[] = [];
      for (const msg of newMessages) {
        userMessages.set(msg.id, msg);
        newIds.push(msg.id);
      }
      messages.set(userId, userMessages);
      const existing = messageOrder.get(userId) ?? [];
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

  updateConversation: (userId, updates) =>
    set((state) => {
      const existing = state.conversations.get(userId);
      if (!existing) return state;
      const conversations = new Map(state.conversations);
      conversations.set(userId, { ...existing, ...updates });
      return { conversations };
    }),
}));
