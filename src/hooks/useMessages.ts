import { useCallback } from 'react';
import { generateUUIDv7 } from 'ecto-shared';
import type { Message } from 'ecto-shared';
import { useMessageStore } from '../stores/message.js';
import { useReadStateStore } from '../stores/read-state.js';
import { useUiStore } from '../stores/ui.js';
import { useAuthStore } from '../stores/auth.js';
import { useMemberStore } from '../stores/member.js';
import { connectionManager } from '../services/connection-manager.js';

export function useMessages(channelId: string) {
  const messages = useMessageStore((s) => s.messages.get(channelId));
  const messageOrder = useMessageStore((s) => s.messageOrder.get(channelId));
  const hasMore = useMessageStore((s) => s.hasMore.get(channelId) ?? true);
  const typingUsers = useMessageStore((s) => s.typingUsers.get(channelId));

  const loadMessages = useCallback(async () => {
    const serverId = useUiStore.getState().activeServerId;
    if (!serverId) return;
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    const result = await trpc.messages.list.query({ channel_id: channelId, limit: 50 });
    useMessageStore.getState().prependMessages(channelId, result.messages, result.has_more);
  }, [channelId]);

  const loadOlderMessages = useCallback(async () => {
    const serverId = useUiStore.getState().activeServerId;
    if (!serverId) return;
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    const oldest = useMessageStore.getState().oldestLoaded.get(channelId);
    const result = await trpc.messages.list.query({
      channel_id: channelId,
      before: oldest,
      limit: 50,
    });
    useMessageStore.getState().prependMessages(channelId, result.messages, result.has_more);
  }, [channelId]);

  const sendMessage = useCallback(
    async (content: string, replyTo?: string, attachmentIds?: string[]) => {
      const serverId = useUiStore.getState().activeServerId;
      if (!serverId) return;
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) return;

      // Build optimistic message
      const tempId = generateUUIDv7();
      const nonce = tempId; // Use tempId as nonce for WS echo suppression
      const user = useAuthStore.getState().user;
      const member = user ? useMemberStore.getState().members.get(serverId)?.get(user.id) : undefined;
      if (user) {
        const optimistic: Message = {
          id: tempId,
          channel_id: channelId,
          author: {
            id: user.id,
            username: user.username,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            nickname: member?.nickname ?? null,
          },
          content: content || null,
          type: 0,
          reply_to: replyTo ?? null,
          pinned: false,
          mention_everyone: false,
          mention_roles: [],
          mentions: [],
          edited_at: null,
          created_at: new Date().toISOString(),
          attachments: [],
          reactions: [],
          webhook_id: null,
        };
        useMessageStore.getState().addMessage(channelId, optimistic);
        useMessageStore.getState().addNonce(nonce);
      }

      try {
        const real = await trpc.messages.send.mutate({
          channel_id: channelId,
          content: content || undefined,
          reply_to: replyTo,
          attachment_ids: attachmentIds,
          nonce,
        });
        if (real && user) {
          useMessageStore.getState().replaceMessage(channelId, tempId, real as Message);
        }
      } catch {
        // Remove optimistic message on failure
        if (user) {
          useMessageStore.getState().deleteMessage(channelId, tempId);
          useMessageStore.getState().consumeNonce(nonce);
        }
      }
    },
    [channelId],
  );

  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      const serverId = useUiStore.getState().activeServerId;
      if (!serverId) return;
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) return;
      await trpc.messages.update.mutate({ message_id: messageId, content });
    },
    [],
  );

  const deleteMessage = useCallback(async (messageId: string) => {
    const serverId = useUiStore.getState().activeServerId;
    if (!serverId) return;
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    await trpc.messages.delete.mutate({ message_id: messageId });
  }, []);

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const serverId = useUiStore.getState().activeServerId;
      if (!serverId) return;
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) return;
      const msg = useMessageStore.getState().messages.get(channelId)?.get(messageId);
      const existingReaction = msg?.reactions.find((r) => r.emoji === emoji);
      const action = existingReaction?.me ? 'remove' : 'add';
      const userId = useAuthStore.getState().user?.id;

      // Optimistic update
      if (userId) {
        useMessageStore.getState().updateReaction(
          channelId, messageId, emoji, userId, action,
          action === 'add'
            ? (existingReaction?.count ?? 0) + 1
            : Math.max((existingReaction?.count ?? 1) - 1, 0),
        );
      }

      try {
        await trpc.messages.react.mutate({ message_id: messageId, emoji, action });
      } catch {
        // Revert on failure
        if (userId) {
          const revertAction = action === 'add' ? 'remove' : 'add';
          useMessageStore.getState().updateReaction(
            channelId, messageId, emoji, userId, revertAction,
            revertAction === 'add'
              ? (existingReaction?.count ?? 0)
              : Math.max((existingReaction?.count ?? 1), 0),
          );
        }
      }
    },
    [channelId],
  );

  const pinMessage = useCallback(async (messageId: string) => {
    const serverId = useUiStore.getState().activeServerId;
    if (!serverId) return;
    useMessageStore.getState().updateMessage(channelId, { id: messageId, pinned: true });
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    try {
      await trpc.messages.pin.mutate({ message_id: messageId, pinned: true });
    } catch {
      useMessageStore.getState().updateMessage(channelId, { id: messageId, pinned: false });
    }
  }, [channelId]);

  const unpinMessage = useCallback(async (messageId: string) => {
    const serverId = useUiStore.getState().activeServerId;
    if (!serverId) return;
    useMessageStore.getState().updateMessage(channelId, { id: messageId, pinned: false });
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    try {
      await trpc.messages.pin.mutate({ message_id: messageId, pinned: false });
    } catch {
      useMessageStore.getState().updateMessage(channelId, { id: messageId, pinned: true });
    }
  }, [channelId]);

  const markRead = useCallback(
    async (messageId: string) => {
      const serverId = useUiStore.getState().activeServerId;
      if (!serverId) return;
      useReadStateStore.getState().markRead(channelId, messageId);
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) return;
      await trpc.read_state.update.mutate({
        channel_id: channelId,
        last_read_message_id: messageId,
      });
    },
    [channelId],
  );

  const orderedMessages = messageOrder
    ?.map((id) => messages?.get(id))
    .filter((m): m is NonNullable<typeof m> => m != null);

  return {
    messages: orderedMessages ?? [],
    hasMore,
    typingUsers,
    loadMessages,
    loadOlderMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    pinMessage,
    unpinMessage,
    markRead,
  };
}
