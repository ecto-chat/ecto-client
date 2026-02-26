import { useCallback } from 'react';

import { useDmStore } from '@/stores/dm';

import { connectionManager } from '@/services/connection-manager';

import type { Attachment } from 'ecto-shared';

import { sendDmMessage } from './dm-utils';
import { toggleReaction } from '@/lib/reactions';

export function useDmActions(
  userId: string | undefined,
  currentUserId: string | undefined,
  setHasMore: (v: boolean) => void,
) {
  const handleSend = useCallback(async (text: string, attachments?: Attachment[], replyTo?: string) => {
    if (!userId) return;
    if (!text.trim() && (!attachments || attachments.length === 0)) return;
    await sendDmMessage(userId, text, attachments, replyTo);
  }, [userId]);

  const handleLoadMore = useCallback(async () => {
    if (!userId) return;
    const order = useDmStore.getState().messageOrder.get(userId);
    const oldestId = order?.[0];
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc || !oldestId) return;
    const result = await centralTrpc.dms.history.query({
      user_id: userId,
      before: oldestId,
      limit: 50,
    });
    useDmStore.getState().prependMessages(userId, result.messages);
    setHasMore(result.has_more);
  }, [userId, setHasMore]);

  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    if (!userId || !currentUserId) return;
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;

    const msg = useDmStore.getState().messages.get(userId)?.get(messageId);
    if (msg) {
      const newReactions = toggleReaction(msg.reactions, emoji, currentUserId);
      useDmStore.getState().updateReactions(userId, messageId, newReactions);
    }

    try {
      await centralTrpc.dms.react.mutate({ message_id: messageId, emoji });
    } catch {
      if (msg) {
        useDmStore.getState().updateReactions(userId, messageId, msg.reactions);
      }
    }
  }, [userId, currentUserId]);

  const handleEdit = useCallback(async (messageId: string, content: string) => {
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;
    await centralTrpc.dms.edit.mutate({ message_id: messageId, content });
  }, []);

  const handleDelete = useCallback(async (messageId: string) => {
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc || !userId) return;
    useDmStore.getState().deleteMessage(userId, messageId);
    try {
      await centralTrpc.dms.delete.mutate({ message_id: messageId });
    } catch {
      // Message already removed from UI — silent fail
    }
  }, [userId]);

  const handlePin = useCallback(async (messageId: string) => {
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;
    await centralTrpc.dms.pin.mutate({ message_id: messageId, pinned: true });
  }, []);

  const handleUnpin = useCallback(async (messageId: string) => {
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;
    await centralTrpc.dms.pin.mutate({ message_id: messageId, pinned: false });
  }, []);

  const handleMarkRead = useCallback(async (messageId: string) => {
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc || !userId) return;
    await centralTrpc.dms.markRead.mutate({
      user_id: userId,
      last_read_message_id: messageId,
    });
  }, [userId]);

  return {
    handleSend,
    handleLoadMore,
    handleEdit,
    handleDelete,
    handleReact,
    handlePin,
    handleUnpin,
    handleMarkRead,
  };
}
