import { useRef, useEffect, useCallback } from 'react';

import { Spinner, ScrollArea } from '@/ui';

import type { Message } from 'ecto-shared';

import { MessageItem } from './MessageItem';

type MessageListProps = {
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
};

export function MessageList({
  messages, hasMore, onLoadMore, onEdit, onDelete, onReact,
  onPin, onUnpin, onMarkRead, readOnly, reactOnly,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const wasAtBottom = useRef(true);
  const loadingMore = useRef(false);

  const isAtBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  }, []);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = containerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  // Auto-scroll on new messages if already at bottom
  useEffect(() => {
    if (wasAtBottom.current) scrollToBottom();
  }, [messages.length, scrollToBottom]);

  // Scroll to bottom when channel changes (messages identity changes)
  const prevMessagesRef = useRef(messages);
  useEffect(() => {
    if (messages !== prevMessagesRef.current) {
      wasAtBottom.current = true;
      scrollToBottom();
    }
    prevMessagesRef.current = messages;
  }, [messages, scrollToBottom]);

  const handleScroll = () => {
    wasAtBottom.current = isAtBottom();
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
              if (el) {
                const newHeight = el.scrollHeight;
                el.scrollTop += newHeight - prevHeight;
              }
            })
            .finally(() => { loadingMore.current = false; });
        }
      },
      { root: containerRef.current, threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  const jumpToMessage = useCallback((messageId: string) => {
    const wrapper = containerRef.current?.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement | null;
    if (!wrapper) return;
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Delay glow until scroll settles, then fade out
    setTimeout(() => {
      wrapper.style.background = 'rgba(108, 99, 255, 0.3)';
      wrapper.style.boxShadow = 'inset 0 0 0 1px rgba(108, 99, 255, 0.4)';
      wrapper.style.borderRadius = '6px';
      setTimeout(() => {
        wrapper.style.transition = 'background 1s ease-out, box-shadow 1s ease-out';
        wrapper.style.background = '';
        wrapper.style.boxShadow = '';
        setTimeout(() => {
          wrapper.style.transition = '';
          wrapper.style.borderRadius = '';
        }, 1000);
      }, 800);
    }, 300);
  }, []);

  // Group messages and add date separators
  let lastDate = '';
  let lastAuthorId = '';

  return (
    <ScrollArea
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1"
    >
      <div ref={topSentinelRef} className="flex justify-center py-2">
        {hasMore && <Spinner size="sm" />}
      </div>

      {messages.map((msg, idx) => {
        const msgDate = new Date(msg.created_at).toLocaleDateString();
        const showDateSeparator = msgDate !== lastDate;
        if (showDateSeparator) lastAuthorId = '';
        lastDate = msgDate;

        const currentAuthorId = msg.author?.id ?? '';
        const isGrouped = !showDateSeparator && currentAuthorId === lastAuthorId && currentAuthorId !== '';
        lastAuthorId = currentAuthorId;

        return (
          <div key={msg.id} data-message-id={msg.id} className={isGrouped ? 'mt-0.5' : idx === 0 ? '' : 'mt-4'}>
            {showDateSeparator && (
              <div className="my-2 flex items-center gap-3 px-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted">{msgDate}</span>
                <div className="h-px flex-1 bg-border" />
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
              grouped={isGrouped}
              onJumpToMessage={jumpToMessage}
            />
          </div>
        );
      })}
    </ScrollArea>
  );
}
