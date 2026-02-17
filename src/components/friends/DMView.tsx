import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MessageList } from '../chat/MessageList.js';
import { TypingIndicator } from '../chat/TypingIndicator.js';
import { useDmStore } from '../../stores/dm.js';
import { useFriendStore } from '../../stores/friend.js';
import { usePresence } from '../../hooks/usePresence.js';
import { useAuthStore } from '../../stores/auth.js';
import { useCall } from '../../hooks/useCall.js';
import { connectionManager } from '../../services/connection-manager.js';
import { Avatar } from '../common/Avatar.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import { renderMarkdown } from '../../lib/markdown.js';
import { generateUUIDv7 } from 'ecto-shared';
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

export function DMView() {
  const { userId } = useParams<{ userId: string }>();
  const friend = useFriendStore((s) => (userId ? s.friends.get(userId) : undefined));
  const dmMessages = useDmStore((s) => (userId ? s.messages.get(userId) : undefined));
  const messageOrder = useDmStore((s) => (userId ? s.messageOrder.get(userId) : undefined));
  const typingUsers = useDmStore((s) => s.typingUsers);
  const { status } = usePresence(userId ?? '');
  const currentUserId = useAuthStore((s) => s.user?.id);

  const { startCall, isInCall } = useCall();
  const [content, setContent] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialLoadDone = useRef(false);

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

  const handleSend = useCallback(async (text: string) => {
    if (!userId || !text.trim()) return;
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
        attachments: [],
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
      const real = await centralTrpc.dms.send.mutate({ recipient_id: userId, content: text.trim() });
      // Replace optimistic temp with real message from server
      if (user) {
        useDmStore.setState((s) => {
          const userMsgs = s.messages.get(userId);
          if (!userMsgs?.has(tempId)) return s;
          const messages = new Map(s.messages);
          const messageOrder = new Map(s.messageOrder);
          const updated = new Map(userMsgs);
          updated.delete(tempId);
          updated.set(real.id, real);
          messages.set(userId, updated);
          const order = messageOrder.get(userId) ?? [];
          if (order.includes(real.id)) {
            // WS echo arrived first — just remove temp entry
            messageOrder.set(userId, order.filter((id) => id !== tempId));
          } else {
            messageOrder.set(userId, order.map((id) => (id === tempId ? real.id : id)));
          }
          return { messages, messageOrder };
        });
      }
    } catch {
      if (user) {
        // Remove optimistic on failure — manually remove from store
        const store = useDmStore.getState();
        const msgs = store.messages.get(userId);
        if (msgs?.has(tempId)) {
          const updated = new Map(msgs);
          updated.delete(tempId);
          const order = (store.messageOrder.get(userId) ?? []).filter((id) => id !== tempId);
          // Direct state update via set
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

  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    if (!userId) return;
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;

    // Optimistic update
    const store = useDmStore.getState();
    const msg = store.messages.get(userId)?.get(messageId);
    if (msg && currentUserId) {
      const existing = msg.reactions.find((r) => r.emoji === emoji);
      const isRemoving = existing?.me;
      let newReactions = [...msg.reactions];
      if (isRemoving && existing) {
        const newUsers = existing.users.filter((u) => u !== currentUserId);
        if (newUsers.length === 0) {
          newReactions = newReactions.filter((r) => r.emoji !== emoji);
        } else {
          newReactions = newReactions.map((r) =>
            r.emoji === emoji ? { ...r, count: newUsers.length, users: newUsers, me: false } : r,
          );
        }
      } else {
        if (existing) {
          newReactions = newReactions.map((r) =>
            r.emoji === emoji
              ? { ...r, count: r.count + 1, users: [...r.users, currentUserId], me: true }
              : r,
          );
        } else {
          newReactions.push({ emoji, count: 1, users: [currentUserId], me: true });
        }
      }
      useDmStore.getState().updateReactions(userId, messageId, newReactions);
    }

    try {
      await centralTrpc.dms.react.mutate({ message_id: messageId, emoji });
    } catch {
      // Revert: restore original reactions
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
    // Optimistic removal
    useDmStore.getState().deleteMessage(userId, messageId);
    try {
      await centralTrpc.dms.delete.mutate({ message_id: messageId });
    } catch {
      // Message already removed from UI, no easy revert — silent fail
    }
  }, [userId]);

  const [showPinned, setShowPinned] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [pinnedLoading, setPinnedLoading] = useState(false);

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

  const loadPinnedMessages = useCallback(async () => {
    if (!userId) return;
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;
    setPinnedLoading(true);
    try {
      const pinned = await centralTrpc.dms.listPinned.query({ user_id: userId });
      setPinnedMessages(pinned.map(dmToMessage));
    } catch {
      // silent
    } finally {
      setPinnedLoading(false);
    }
  }, [userId]);

  const togglePinned = useCallback(() => {
    if (!showPinned) {
      loadPinnedMessages();
    }
    setShowPinned((prev) => !prev);
  }, [showPinned, loadPinnedMessages]);

  return (
    <div className="channel-view">
      <div className="channel-header">
        <Avatar src={friend?.avatar_url} username={username} size={28} status={status} />
        <span className="channel-header-name" style={{ marginLeft: 8 }}>{username}</span>
        <div className="channel-header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            className="icon-btn"
            onClick={togglePinned}
            title={showPinned ? 'Hide Pinned Messages' : 'Pinned Messages'}
            style={{ opacity: showPinned ? 1 : 0.7 }}
          >
            &#128204;
          </button>
          <button
            className="icon-btn"
            onClick={() => userId && startCall(userId, ['audio'])}
            disabled={isInCall}
            title={isInCall ? 'Already in a call' : 'Voice Call'}
          >
            &#128222;
          </button>
          <button
            className="icon-btn"
            onClick={() => userId && startCall(userId, ['audio', 'video'])}
            disabled={isInCall}
            title={isInCall ? 'Already in a call' : 'Video Call'}
          >
            &#127909;
          </button>
        </div>
      </div>

      <MessageList
        messages={messages}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onReact={handleReact}
        onPin={handlePin}
        onUnpin={handleUnpin}
        onMarkRead={async () => {}}
        reactOnly
      />

      {showPinned && (
        <div style={{
          borderTop: '1px solid var(--border, #40444b)',
          maxHeight: 300,
          overflowY: 'auto',
          padding: '8px 16px',
          backgroundColor: 'var(--bg-secondary, #2f3136)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary, #fff)', fontSize: 14 }}>
              Pinned Messages
            </span>
            <button
              onClick={() => setShowPinned(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary, #b9bbbe)',
                cursor: 'pointer',
                fontSize: 16,
              }}
            >
              &#10005;
            </button>
          </div>
          {pinnedLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
              <LoadingSpinner size={20} />
            </div>
          )}
          {!pinnedLoading && pinnedMessages.length === 0 && (
            <p style={{ color: 'var(--text-muted, #72767d)', fontSize: 13, textAlign: 'center', padding: 12 }}>
              No pinned messages in this conversation.
            </p>
          )}
          {pinnedMessages.map((msg) => (
            <div
              key={msg.id}
              style={{
                padding: '8px 12px',
                borderRadius: 4,
                backgroundColor: 'var(--bg-primary, #36393f)',
                marginBottom: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Avatar
                  src={msg.author?.avatar_url}
                  username={msg.author?.username ?? 'Unknown'}
                  size={18}
                />
                <span style={{ fontWeight: 600, color: 'var(--text-primary, #fff)', fontSize: 13 }}>
                  {msg.author?.display_name ?? msg.author?.username ?? 'Unknown'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted, #72767d)' }}>
                  {new Date(msg.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div
                className="message-content message-markdown"
                style={{ fontSize: 13, color: 'var(--text-secondary, #b9bbbe)' }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content ?? '') }}
              />
            </div>
          ))}
        </div>
      )}

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
