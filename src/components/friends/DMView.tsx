import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MessageList } from '../chat/MessageList.js';
import { TypingIndicator } from '../chat/TypingIndicator.js';
import { useDmStore } from '../../stores/dm.js';
import { useFriendStore } from '../../stores/friend.js';
import { usePresence } from '../../hooks/usePresence.js';
import { useAuthStore } from '../../stores/auth.js';
import { connectionManager } from '../../services/connection-manager.js';
import { Avatar } from '../common/Avatar.js';
import type { Message, DirectMessage } from 'ecto-shared';

/** Adapt a DirectMessage to the Message shape used by MessageList/MessageItem */
function dmToMessage(dm: DirectMessage): Message {
  return {
    id: dm.id,
    channel_id: '',
    author: dm.sender,
    content: dm.content,
    type: 0,
    reply_to: null,
    pinned: false,
    mention_everyone: false,
    mention_roles: [],
    mentions: [],
    edited_at: dm.edited_at,
    created_at: dm.created_at,
    attachments: dm.attachments ?? [],
    reactions: [],
  };
}

export function DMView() {
  const { userId } = useParams<{ userId: string }>();
  const friend = useFriendStore((s) => (userId ? s.friends.get(userId) : undefined));
  const dmMessages = useDmStore((s) => (userId ? s.messages.get(userId) : undefined));
  const messageOrder = useDmStore((s) => (userId ? s.messageOrder.get(userId) : undefined));
  const typingUsers = useDmStore((s) => s.typingUsers);
  const { status } = usePresence(userId ?? '');
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [content, setContent] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialLoadDone = useRef(false);

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

  const handleSend = useCallback(async (text: string) => {
    if (!userId || !text.trim()) return;
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;
    await centralTrpc.dms.send.mutate({ recipient_id: userId, content: text.trim() });
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
  }, [userId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = content.trim();
      if (text) {
        handleSend(text);
        setContent('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      }
    }
    // Send typing indicator
    if (userId) {
      connectionManager.getCentralWs()?.sendDmTyping(userId);
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
  };

  // Convert DM messages to Message[] for MessageList
  const messages: Message[] = (messageOrder
    ?.map((id) => dmMessages?.get(id))
    .filter((m): m is DirectMessage => m != null)
    .map(dmToMessage)) ?? [];

  // Build typing map for TypingIndicator (channelId-based, but we use peerId)
  const peerTyping = userId ? typingUsers.get(userId) : undefined;
  const isPeerTyping = peerTyping !== undefined && Date.now() - peerTyping < 8000;

  const username = friend?.username ?? userId ?? 'Unknown';

  // No-op handlers for features DMs don't support
  const noop = async () => {};

  return (
    <div className="channel-view">
      <div className="channel-header">
        <Avatar src={friend?.avatar_url} username={username} size={28} status={status} />
        <span className="channel-header-name" style={{ marginLeft: 8 }}>{username}</span>
      </div>

      <MessageList
        messages={messages}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        onEdit={noop}
        onDelete={noop}
        onReact={noop}
        onPin={noop}
        onUnpin={noop}
        onMarkRead={noop}
        readOnly
      />

      <div className="channel-input-area">
        {isPeerTyping && (
          <div className="typing-indicator">
            <span className="typing-dots">
              <span />
              <span />
              <span />
            </span>
            <span className="typing-text">{username} is typing...</span>
          </div>
        )}
        <div className="message-input-container">
          <div className="message-input-row">
            <textarea
              ref={textareaRef}
              className="message-input"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              placeholder={`Message @${username}`}
              rows={1}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
