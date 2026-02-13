import { useRef, useEffect, useCallback } from 'react';
import { MessageItem } from './MessageItem.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import type { Message } from 'ecto-shared';

interface MessageListProps {
  messages: Message[];
  hasMore: boolean;
  onLoadMore: () => Promise<void>;
  onEdit: (messageId: string, content: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  onReact: (messageId: string, emoji: string) => Promise<void>;
  onPin: (messageId: string) => Promise<void>;
  onUnpin: (messageId: string) => Promise<void>;
  onMarkRead: (messageId: string) => Promise<void>;
  readOnly?: boolean;
  reactOnly?: boolean;
}

export function MessageList({
  messages,
  hasMore,
  onLoadMore,
  onEdit,
  onDelete,
  onReact,
  onPin,
  onUnpin,
  onMarkRead,
  readOnly,
  reactOnly,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const wasAtBottom = useRef(true);
  const loadingMore = useRef(false);

  // Check if scrolled to bottom
  const isAtBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  }, []);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // Auto-scroll on new messages if already at bottom
  useEffect(() => {
    if (wasAtBottom.current) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  // Initial scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  // Track scroll position
  const handleScroll = () => {
    wasAtBottom.current = isAtBottom();

    // Mark read when scrolled to bottom
    if (wasAtBottom.current && messages.length > 0) {
      const lastMsg = messages[messages.length - 1]!;
      onMarkRead(lastMsg.id).catch(() => {});
    }
  };

  // IntersectionObserver for loading more messages
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore.current) {
          loadingMore.current = true;
          const el = containerRef.current;
          const prevHeight = el?.scrollHeight ?? 0;
          onLoadMore()
            .then(() => {
              // Maintain scroll position after prepending
              if (el) {
                const newHeight = el.scrollHeight;
                el.scrollTop += newHeight - prevHeight;
              }
            })
            .finally(() => {
              loadingMore.current = false;
            });
        }
      },
      { root: containerRef.current, threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  // Group messages and add date separators
  let lastDate = '';

  return (
    <div className="message-list" ref={containerRef} onScroll={handleScroll}>
      <div ref={topSentinelRef} className="message-list-sentinel">
        {hasMore && <LoadingSpinner size={20} />}
      </div>

      {messages.map((msg) => {
        const msgDate = new Date(msg.created_at).toLocaleDateString();
        const showDateSeparator = msgDate !== lastDate;
        lastDate = msgDate;

        return (
          <div key={msg.id}>
            {showDateSeparator && (
              <div className="date-separator">
                <span>{msgDate}</span>
              </div>
            )}
            <MessageItem
              message={msg}
              onEdit={onEdit}
              onDelete={onDelete}
              onReact={onReact}
              onPin={msg.pinned ? onUnpin : onPin}
              readOnly={readOnly}
              reactOnly={reactOnly}
            />
          </div>
        );
      })}
    </div>
  );
}
