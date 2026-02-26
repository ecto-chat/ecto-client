import { useState } from 'react';
import { MessageList, ReplyBanner } from '@/features/chat';
import { useServerDmStore } from '@/stores/server-dm';
import { ServerDmHeader } from './ServerDmHeader';
import { ServerDmInput } from './ServerDmInput';
import { ServerDmEmptyState } from './ServerDmEmptyState';
import { useServerDmMessages } from './useServerDmMessages';

export function ServerDmChat() {
  const activeConvoId = useServerDmStore((s) => s.activeConversationId);
  const convo = useServerDmStore((s) =>
    activeConvoId ? s.conversations.get(activeConvoId) : undefined,
  );

  const {
    messages,
    hasMore,
    isPeerTyping,
    handleSend,
    handleLoadMore,
    handleEdit,
    handleDelete,
    handleReact,
    handleMarkRead,
  } = useServerDmMessages(activeConvoId);

  const [replyTo, setReplyTo] = useState<{ id: string; author: string; content: string } | null>(null);
  const [inputExpanded, setInputExpanded] = useState(false);

  if (!activeConvoId || !convo) {
    return <ServerDmEmptyState />;
  }

  const peerName = convo.peer.nickname ?? convo.peer.display_name ?? convo.peer.username;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ServerDmHeader
        peerId={convo.peer.user_id}
        peerName={peerName}
        avatarUrl={convo.peer.avatar_url}
      />

      <MessageList
        messages={messages}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onReact={handleReact}
        onPin={async () => {}} // NOT_IMPLEMENTED: server DM pinning — no server API endpoint
        onUnpin={async () => {}} // NOT_IMPLEMENTED: server DM pinning — no server API endpoint
        onMarkRead={handleMarkRead}
        onReply={(msg) => setReplyTo({
          id: msg.id,
          author: msg.author?.display_name ?? msg.author?.username ?? 'Unknown',
          content: msg.content ?? '',
        })}
        reactOnly
      />

      <div
        className="border-t-2 border-primary flex flex-col overflow-hidden"
        style={{
          height: inputExpanded ? 'calc(100% - 60px)' : replyTo ? '94px' : '60px',
          flexShrink: 0,
          transition: 'height 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {replyTo && <ReplyBanner author={replyTo.author} onCancel={() => setReplyTo(null)} />}
        {isPeerTyping && (
          <div className="px-4 py-1 text-xs text-muted shrink-0">
            {peerName} is typing...
          </div>
        )}
        <ServerDmInput
          conversationId={activeConvoId}
          peerName={peerName}
          onSend={handleSend}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onExpandedChange={setInputExpanded}
        />
      </div>
    </div>
  );
}
