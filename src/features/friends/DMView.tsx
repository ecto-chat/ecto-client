import { useState, useCallback } from 'react';

import { useParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';

import { EmptyState } from '@/ui';
import { useFriendStore } from '@/stores/friend';
import { useCall } from '@/hooks/useCall';
import { usePresence } from '@/hooks/usePresence';

import { MessageList } from '@/features/chat';

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
        onMarkRead={async () => {}}
        onReply={(msg) => setReplyTo({
          id: msg.id,
          author: msg.author?.display_name ?? msg.author?.username ?? 'Unknown',
          content: msg.content ?? '',
        })}
        reactOnly
      />

      <div className="shrink-0 border-t-2 border-primary">
        <DMTypingIndicator username={username} isTyping={isPeerTyping} />
        <DMMessageInput userId={userId} username={username} onSend={handleSend} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
      </div>

      <DMPinnedMessages userId={userId} open={pinsOpen} onClose={() => setPinsOpen(false)} />
    </div>
  );
}
