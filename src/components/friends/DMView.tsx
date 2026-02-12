import { useEffect, useRef, useState, useCallback, type KeyboardEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useDmStore } from '../../stores/dm.js';
import { useFriendStore } from '../../stores/friend.js';
import { usePresence } from '../../hooks/usePresence.js';
import { useAuthStore } from '../../stores/auth.js';
import { connectionManager } from '../../services/connection-manager.js';
import { Avatar } from '../common/Avatar.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';

export function DMView() {
  const { userId } = useParams<{ userId: string }>();
  const friend = useFriendStore((s) => (userId ? s.friends.get(userId) : undefined));
  const messages = useDmStore((s) => (userId ? s.messages.get(userId) : undefined));
  const messageOrder = useDmStore((s) => (userId ? s.messageOrder.get(userId) : undefined));
  const typingUsers = useDmStore((s) => s.typingUsers);
  const { status } = usePresence(userId ?? '');
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Open conversation and load messages
  useEffect(() => {
    if (!userId) return;
    useDmStore.getState().openConversation(userId);

    // Load message history
    const centralTrpc = connectionManager.getCentralTrpc();
    if (centralTrpc) {
      setLoading(true);
      centralTrpc.dms.history.query({ user_id: userId, limit: 50 })
        .then((result) => {
          useDmStore.getState().prependMessages(userId, result.messages);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }

    return () => {
      useDmStore.getState().closeConversation();
    };
  }, [userId]);

  // Auto-scroll on new messages
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messageOrder?.length]);

  const handleSend = useCallback(async () => {
    if (!userId || !content.trim()) return;
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;

    try {
      await centralTrpc.dms.send.mutate({ recipient_id: userId, content: content.trim() });
      setContent('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch {
      // Send failed
    }
  }, [userId, content]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }

    // Send typing indicator
    if (userId) {
      connectionManager.getCentralWs()?.sendDmTyping(userId);
    }
  };

  const orderedMessages = messageOrder
    ?.map((id) => messages?.get(id))
    .filter((m): m is NonNullable<typeof m> => m != null) ?? [];

  // Check if peer is typing
  const peerTyping = userId ? typingUsers.get(userId) : undefined;
  const isPeerTyping = peerTyping !== undefined && Date.now() - peerTyping < 8000;

  const username = friend?.username ?? userId ?? 'Unknown';

  return (
    <div className="dm-view">
      <div className="dm-header">
        <Avatar src={friend?.avatar_url} username={username} size={32} status={status} />
        <span className="dm-header-name">{username}</span>
      </div>

      <div className="dm-messages" ref={containerRef}>
        {loading && (
          <div className="dm-loading">
            <LoadingSpinner />
          </div>
        )}

        {orderedMessages.map((msg) => {
          const isMe = msg.sender_id === currentUserId;
          const timestamp = new Date(msg.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div key={msg.id} className={`dm-message ${isMe ? 'own' : ''}`}>
              <Avatar
                src={isMe ? undefined : friend?.avatar_url}
                username={isMe ? 'Me' : username}
                size={36}
              />
              <div className="dm-message-body">
                <div className="dm-message-header">
                  <span className="dm-message-author">{isMe ? 'You' : username}</span>
                  <span className="message-timestamp">{timestamp}</span>
                </div>
                <div className="dm-message-content">{msg.content}</div>
              </div>
            </div>
          );
        })}
      </div>

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

      <div className="dm-input-container">
        <textarea
          ref={textareaRef}
          className="message-input"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message @${username}`}
          rows={1}
        />
      </div>
    </div>
  );
}
