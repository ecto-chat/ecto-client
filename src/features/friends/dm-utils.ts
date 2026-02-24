import { generateUUIDv7 } from 'ecto-shared';

import { useDmStore } from '@/stores/dm';
import { useAuthStore } from '@/stores/auth';

import { connectionManager } from '@/services/connection-manager';

import type { Attachment, DirectMessage, Message, ReactionGroup } from 'ecto-shared';

/** Adapt a DirectMessage to the Message shape used by MessageList/MessageItem. */
export function dmToMessage(dm: DirectMessage): Message {
  return {
    id: dm.id,
    channel_id: '',
    author: dm.sender,
    content: dm.content,
    type: 0,
    reply_to: null,
    pinned: dm.pinned ?? false,
    mention_everyone: false,
    mention_roles: [],
    mentions: [],
    edited_at: dm.edited_at,
    created_at: dm.created_at,
    attachments: dm.attachments ?? [],
    reactions: dm.reactions ?? [],
    webhook_id: null,
  };
}

/** Send a DM with optimistic insert and reconciliation. */
export async function sendDmMessage(userId: string, text: string, attachments?: Attachment[]): Promise<void> {
  const centralTrpc = connectionManager.getCentralTrpc();
  if (!centralTrpc) return;

  const user = useAuthStore.getState().user;
  const tempId = generateUUIDv7();
  if (user) {
    const optimistic: DirectMessage = {
      id: tempId,
      sender_id: user.id,
      recipient_id: userId,
      content: text.trim(),
      attachments: attachments ?? [],
      reactions: [],
      pinned: false,
      pinned_at: null,
      edited_at: null,
      created_at: new Date().toISOString(),
      sender: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        nickname: null,
      },
    };
    useDmStore.getState().addMessage(userId, optimistic);
  }

  try {
    const real = await centralTrpc.dms.send.mutate({
      recipient_id: userId,
      content: text.trim() || undefined,
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
    });
    if (user) {
      useDmStore.setState((s) => {
        const userMsgs = s.messages.get(userId);
        if (!userMsgs?.has(tempId)) return s;
        const msgs = new Map(s.messages);
        const order = new Map(s.messageOrder);
        const updated = new Map(userMsgs);
        updated.delete(tempId);
        updated.set(real.id, real);
        msgs.set(userId, updated);
        const ids = order.get(userId) ?? [];
        if (ids.includes(real.id)) {
          order.set(userId, ids.filter((id) => id !== tempId));
        } else {
          order.set(userId, ids.map((id) => (id === tempId ? real.id : id)));
        }
        return { messages: msgs, messageOrder: order };
      });
    }
  } catch {
    if (user) {
      const store = useDmStore.getState();
      const msgs = store.messages.get(userId);
      if (msgs?.has(tempId)) {
        const updated = new Map(msgs);
        updated.delete(tempId);
        const order = (store.messageOrder.get(userId) ?? []).filter((id) => id !== tempId);
        useDmStore.setState((s) => {
          const messages = new Map(s.messages);
          const messageOrder = new Map(s.messageOrder);
          messages.set(userId, updated);
          messageOrder.set(userId, order);
          return { messages, messageOrder };
        });
      }
    }
  }
}

/** Compute optimistic reaction toggle. Returns new reactions array. */
export function toggleReaction(
  reactions: ReactionGroup[],
  emoji: string,
  currentUserId: string,
): ReactionGroup[] {
  const existing = reactions.find((r) => r.emoji === emoji);
  const isRemoving = existing?.me;

  if (isRemoving && existing) {
    const newUsers = existing.users.filter((u) => u !== currentUserId);
    if (newUsers.length === 0) {
      return reactions.filter((r) => r.emoji !== emoji);
    }
    return reactions.map((r) =>
      r.emoji === emoji ? { ...r, count: newUsers.length, users: newUsers, me: false } : r,
    );
  }

  if (existing) {
    return reactions.map((r) =>
      r.emoji === emoji
        ? { ...r, count: r.count + 1, users: [...r.users, currentUserId], me: true }
        : r,
    );
  }

  return [...reactions, { emoji, count: 1, users: [currentUserId], me: true }];
}
