import { useCallback } from 'react';
import { useServerDmStore } from '@/stores/server-dm';
import { useUiStore } from '@/stores/ui';
import { connectionManager } from '@/services/connection-manager';
import { toggleReaction } from '@/features/friends/dm-utils';

export function useServerDmActions(
  conversationId: string | null,
  currentUserId: string | undefined,
  setHasMore: (v: boolean) => void,
) {
  const getServerTrpc = useCallback(() => {
    const serverId = useUiStore.getState().activeServerId;
    if (!serverId) return null;
    return connectionManager.getServerTrpc(serverId);
  }, []);

  const handleSend = useCallback(async (text: string) => {
    if (!conversationId || !text.trim()) return;
    const trpc = getServerTrpc();
    if (!trpc) return;

    // Find the peer from the conversation
    const convo = useServerDmStore.getState().conversations.get(conversationId);
    if (!convo) return;

    const result = await trpc.serverDms.send.mutate({
      recipient_id: convo.peer.user_id,
      content: text.trim(),
    });

    // If this was a pending conversation, switch to the real one
    if (conversationId.startsWith('pending-') && result.conversation_id !== conversationId) {
      const store = useServerDmStore.getState();
      const pendingConvo = store.conversations.get(conversationId);
      const conversations = new Map(store.conversations);
      conversations.delete(conversationId);
      // Transfer peer data from the pending placeholder to the real conversation
      if (pendingConvo) {
        conversations.set(result.conversation_id, {
          ...pendingConvo,
          id: result.conversation_id,
          last_message: result,
        });
      }
      useServerDmStore.setState({ conversations });
      useServerDmStore.getState().setActiveConversation(result.conversation_id);
    }
  }, [conversationId, getServerTrpc]);

  const handleLoadMore = useCallback(async () => {
    if (!conversationId || conversationId.startsWith('pending-')) return;
    const trpc = getServerTrpc();
    if (!trpc) return;

    const order = useServerDmStore.getState().messageOrder.get(conversationId);
    const oldestId = order?.[0];
    if (!oldestId) return;

    const result = await trpc.serverDms.history.query({
      conversation_id: conversationId,
      before: oldestId,
      limit: 50,
    });
    useServerDmStore.getState().prependMessages(conversationId, result.messages);
    setHasMore(result.has_more);
  }, [conversationId, getServerTrpc, setHasMore]);

  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    if (!conversationId || !currentUserId) return;
    const trpc = getServerTrpc();
    if (!trpc) return;

    const msg = useServerDmStore.getState().messages.get(conversationId)?.get(messageId);
    if (msg) {
      const newReactions = toggleReaction(msg.reactions, emoji, currentUserId);
      useServerDmStore.getState().updateReactions(conversationId, messageId, newReactions);
    }

    try {
      const existing = msg?.reactions.find((r) => r.emoji === emoji);
      const action = existing?.me ? 'remove' : 'add';
      await trpc.serverDms.react.mutate({ message_id: messageId, emoji, action });
    } catch {
      if (msg) {
        useServerDmStore.getState().updateReactions(conversationId, messageId, msg.reactions);
      }
    }
  }, [conversationId, currentUserId, getServerTrpc]);

  const handleEdit = useCallback(async (messageId: string, content: string) => {
    const trpc = getServerTrpc();
    if (!trpc) return;
    await trpc.serverDms.edit.mutate({ message_id: messageId, content });
  }, [getServerTrpc]);

  const handleDelete = useCallback(async (messageId: string) => {
    const trpc = getServerTrpc();
    if (!trpc || !conversationId) return;
    useServerDmStore.getState().deleteMessage(conversationId, messageId);
    try {
      await trpc.serverDms.delete.mutate({ message_id: messageId });
    } catch {
      // Message already removed from UI
    }
  }, [conversationId, getServerTrpc]);

  return {
    handleSend,
    handleLoadMore,
    handleEdit,
    handleDelete,
    handleReact,
  };
}
