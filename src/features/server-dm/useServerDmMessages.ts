import { useEffect, useRef, useState } from 'react';
import { useServerDmStore } from '@/stores/server-dm';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { connectionManager } from '@/services/connection-manager';
import type { ServerDmMessage, Message } from 'ecto-shared';
import { useServerDmActions } from './useServerDmActions';

/** Adapt a ServerDmMessage to the Message shape used by MessageList. */
function serverDmToMessage(dm: ServerDmMessage): Message {
  return {
    id: dm.id,
    channel_id: dm.conversation_id,
    author: dm.author,
    content: dm.content,
    type: 0,
    reply_to: dm.reply_to ?? null,
    pinned: false,
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

export function useServerDmMessages(conversationId: string | null) {
  const dmMessages = useServerDmStore((s) =>
    conversationId ? s.messages.get(conversationId) : undefined,
  );
  const messageOrder = useServerDmStore((s) =>
    conversationId ? s.messageOrder.get(conversationId) : undefined,
  );
  const typingPeers = useServerDmStore((s) => s.typingPeers);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [hasMore, setHasMore] = useState(true);
  const initialLoadDone = useRef(false);

  const actions = useServerDmActions(conversationId, currentUserId, setHasMore);

  // Periodically clear expired typing indicators
  useEffect(() => {
    const timer = setInterval(() => {
      useServerDmStore.getState().clearExpiredTyping();
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // Load initial messages when conversation is selected
  useEffect(() => {
    if (!conversationId) return;
    useServerDmStore.getState().setActiveConversation(conversationId);
    // Mark conversation as read when viewing it
    const serverId = useUiStore.getState().activeServerId;
    if (serverId) {
      useServerDmStore.getState().markConversationRead(serverId, conversationId);
      // Persist to server
      const convo = useServerDmStore.getState().conversations.get(conversationId);
      const lastMsgId = convo?.last_message?.id;
      if (lastMsgId && !conversationId.startsWith('pending-')) {
        connectionManager.getServerTrpc(serverId)?.serverDms.markRead
          .mutate({ conversation_id: conversationId, last_read_message_id: lastMsgId })
          .catch(() => {});
      }
    }

    if (!initialLoadDone.current) {
      // Skip history fetch for placeholder conversations (created before first message is sent)
      if (!conversationId.startsWith('pending-')) {
        const serverId = useUiStore.getState().activeServerId;
        if (serverId) {
          const trpc = connectionManager.getServerTrpc(serverId);
          if (trpc) {
            trpc.serverDms.history
              .query({ conversation_id: conversationId, limit: 50 })
              .then((result) => {
                useServerDmStore.getState().prependMessages(conversationId, result.messages);
                setHasMore(result.has_more);
              })
              .catch(() => {});
          }
        }
      } else {
        setHasMore(false);
      }
      initialLoadDone.current = true;
    }

    return () => {
      useServerDmStore.getState().setActiveConversation(null);
      initialLoadDone.current = false;
    };
  }, [conversationId]);

  const messages: Message[] =
    messageOrder
      ?.map((id) => dmMessages?.get(id))
      .filter((m): m is ServerDmMessage => m != null)
      .map(serverDmToMessage) ?? [];

  const peerTyping = conversationId ? typingPeers.get(conversationId) : undefined;
  const isPeerTyping = peerTyping !== undefined && Date.now() - peerTyping < 8000;

  return {
    messages,
    hasMore,
    isPeerTyping,
    ...actions,
  };
}
