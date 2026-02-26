import { useState, useCallback } from 'react';

import { useParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';

import { EmptyState } from '@/ui';
import { useFriendStore } from '@/stores/friend';
import { useCall } from '@/hooks/useCall';
import { usePresence } from '@/hooks/usePresence';

import { MessageList, ReplyBanner } from '@/features/chat';

import { DMHeader } from './DMHeader';
import { DMTypingIndicator } from './DMTypingIndicator';
import { DMMessageInput } from './DMMessageInput';
import { DMPinnedMessages } from './DMPinnedMessages';
import { useDmMessages } from './useDmMessages';

export function DMView() {
  const { userId } = useParams<{ userId: string }>();
  const friend = useFriendStore((s) => (userId ? s.friends.get(userId) : undefined));
  const { status } = usePresence(userId ?? '');
  const { startCall, isInCall } = useCall();
  const [pinsOpen, setPinsOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; author: string; content: string } | null>(null);
  const [inputExpanded, setInputExpanded] = useState(false);

  const {
    messages,
    hasMore,
    isPeerTyping,
    handleSend,
    handleLoadMore,
    handleEdit,
    handleDelete,
    handleReact,
    handlePin,
    handleUnpin,
    handleMarkRead,
  } = useDmMessages(userId);

  const username = friend?.username ?? userId ?? 'Unknown';

  const handleVoiceCall = useCallback(() => {
    if (userId) startCall(userId, ['audio']);
  }, [userId, startCall]);

  const handleVideoCall = useCallback(() => {
    if (userId) startCall(userId, ['audio', 'video']);
  }, [userId, startCall]);

  if (!userId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={<MessageCircle />}
          title="Select a conversation"
          description="Pick a friend from the sidebar to start chatting."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DMHeader
        username={username}
        avatarUrl={friend?.avatar_url}
        status={status}
        pinsOpen={pinsOpen}
        onTogglePins={() => setPinsOpen((v) => !v)}
        onVoiceCall={handleVoiceCall}
        onVideoCall={handleVideoCall}
        isInCall={isInCall}
      />

      <MessageList
        messages={messages}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onReact={handleReact}
        onPin={handlePin}
        onUnpin={handleUnpin}
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
        <DMTypingIndicator username={username} isTyping={isPeerTyping} />
        <DMMessageInput
          userId={userId}
          username={username}
          onSend={handleSend}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onExpandedChange={setInputExpanded}
        />
      </div>

      <DMPinnedMessages userId={userId} open={pinsOpen} onClose={() => setPinsOpen(false)} />
    </div>
  );
}
