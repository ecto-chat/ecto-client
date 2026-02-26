import { useEffect, useRef, useState } from 'react';

import { useDmStore } from '@/stores/dm';
import { useAuthStore } from '@/stores/auth';

import { connectionManager } from '@/services/connection-manager';

import type { DirectMessage, Message } from 'ecto-shared';

import { dmToMessage } from '@/lib/message-adapters';
import { useDmActions } from './useDmActions';

export function useDmMessages(userId: string | undefined) {
  const dmMessages = useDmStore((s) => (userId ? s.messages.get(userId) : undefined));
  const messageOrder = useDmStore((s) => (userId ? s.messageOrder.get(userId) : undefined));
  const typingUsers = useDmStore((s) => s.typingUsers);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [hasMore, setHasMore] = useState(true);
  const initialLoadDone = useRef(false);

  const actions = useDmActions(userId, currentUserId, setHasMore);

  // Periodically clear expired DM typing indicators
  useEffect(() => {
    const timer = setInterval(() => {
      useDmStore.getState().clearExpiredTyping();
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // Open conversation and load messages
  useEffect(() => {
    if (!userId) return;
    useDmStore.getState().openConversation(userId);

    if (!initialLoadDone.current) {
      const centralTrpc = connectionManager.getCentralTrpc();
      if (centralTrpc) {
        centralTrpc.dms.history.query({ user_id: userId, limit: 50 })
          .then((result) => {
            useDmStore.getState().prependMessages(userId, result.messages);
            setHasMore(result.has_more);
          })
          .catch(() => {});
      }
      initialLoadDone.current = true;
    }

    return () => {
      useDmStore.getState().closeConversation();
      initialLoadDone.current = false;
    };
  }, [userId]);

  const messages: Message[] = (messageOrder
    ?.map((id) => dmMessages?.get(id))
    .filter((m): m is DirectMessage => m != null)
    .map(dmToMessage)) ?? [];

  const peerTyping = userId ? typingUsers.get(userId) : undefined;
  const isPeerTyping = peerTyping !== undefined && Date.now() - peerTyping < 8000;

  return {
    messages,
    hasMore,
    isPeerTyping,
    ...actions,
  };
}
