import { useCallback } from 'react';
import { useMessageStore } from '../stores/message.js';
import { useReadStateStore } from '../stores/read-state.js';
import { useUiStore } from '../stores/ui.js';
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
      await trpc.messages.send.mutate({
        channel_id: channelId,
        content: content || undefined,
        reply_to: replyTo,
        attachment_ids: attachmentIds,
      });
      // Message will arrive via WS event
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
      await trpc.messages.react.mutate({ message_id: messageId, emoji, action });
    },
    [channelId],
  );

  const pinMessage = useCallback(async (messageId: string) => {
    const serverId = useUiStore.getState().activeServerId;
    if (!serverId) return;
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    await trpc.messages.pin.mutate({ message_id: messageId, pinned: true });
  }, []);

  const unpinMessage = useCallback(async (messageId: string) => {
    const serverId = useUiStore.getState().activeServerId;
    if (!serverId) return;
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    await trpc.messages.pin.mutate({ message_id: messageId, pinned: false });
  }, []);

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
