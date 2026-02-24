import { useEffect, useRef, useState, useCallback } from 'react';

import { useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { Search, Users, Hash, Pin } from 'lucide-react';

import { IconButton, EmptyState } from '@/ui';

import { useMessageStore } from '@/stores/message';
import { useUiStore } from '@/stores/ui';
import { useChannelStore } from '@/stores/channel';

import { useMessages } from '@/hooks/useMessages';
import { useChannels } from '@/hooks/useChannels';

import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';
import { SearchPanel } from './SearchPanel';
import { PinnedMessages } from './PinnedMessages';
import { NsfwWarning } from './NsfwWarning';
import { ChannelLockedScreen } from './ChannelLockedScreen';
import { VoiceView } from '@/features/voice';
import { PageView } from '@/features/page';

export function ChannelView() {
  const { channelId, serverId } = useParams<{ channelId: string; serverId: string }>();
  const activeServerId = useUiStore((s) => s.activeServerId);
  const sid = serverId ?? activeServerId ?? '';
  const channel = useChannelStore((s) => s.channels.get(sid)?.get(channelId ?? ''));
  const { openChannel, closeChannel } = useChannels(sid);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pinsOpen, setPinsOpen] = useState(false);
  const navigate = useNavigate();

  const handleSearchNavigate = useCallback((targetChannelId: string, _messageId: string) => {
    setSearchOpen(false);
    if (targetChannelId && targetChannelId !== channelId) {
      navigate(`/servers/${sid}/channels/${targetChannelId}`);
    }
  }, [sid, channelId, navigate]);

  const {
    messages, hasMore, typingUsers, loadMessages, loadOlderMessages,
    sendMessage, editMessage, deleteMessage, toggleReaction,
    pinMessage, unpinMessage, markRead,
  } = useMessages(channelId ?? '');
  const initialLoadDone = useRef(false);

  // Subscribe to channel on mount, load messages
  useEffect(() => {
    if (!channelId) return;
    openChannel(channelId);
    if (!initialLoadDone.current) {
      loadMessages().catch(() => {});
      initialLoadDone.current = true;
    }

    const timer = setTimeout(() => {
      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1]!;
        markRead(lastMsg.id).catch(() => {});
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      closeChannel(channelId);
      initialLoadDone.current = false;
    };
  }, [channelId]);

  // Periodically clear expired typing indicators
  useEffect(() => {
    const timer = setInterval(() => {
      useMessageStore.getState().clearExpiredTyping();
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const nsfwDismissed = useUiStore((s) => s.nsfwDismissed.has(channelId ?? ''));
  const bypassNsfw = useUiStore((s) => s.bypassNsfwWarnings);

  const channelLocked = useUiStore((s) => s.channelLocked);

  if (!channelId || !channel) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState icon={<Hash />} title="Select a channel" description="Pick a channel from the sidebar to start chatting." />
      </div>
    );
  }

  if (channelLocked) {
    return (
      <ChannelLockedScreen
        onGoBack={() => {
          useUiStore.getState().setChannelLocked(false);
          navigate(`/servers/${sid}`);
        }}
      />
    );
  }

  if (channel.nsfw && !nsfwDismissed && !bypassNsfw) {
    return (
      <NsfwWarning
        channelId={channelId}
        onGoBack={() => navigate(`/servers/${sid}`)}
      />
    );
  }

  if (channel.type === 'page') {
    return <PageView />;
  }

  if (channel.type === 'voice') {
    return <VoiceView />;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Channel header */}
      <div className="flex h-[60px] shrink-0 items-center gap-2 border-b-2 border-primary px-4">
        <Hash size={18} className="text-muted" />
        <span className="text-sm text-primary">{channel.name}</span>
        {channel.topic && (
          <>
            <div className="mx-2 h-4 w-px bg-border" />
            <span className="truncate text-xs text-muted">{channel.topic}</span>
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          <IconButton variant="ghost" size="sm" tooltip="Pinned Messages" onClick={() => setPinsOpen(true)}>
            <Pin size={16} />
          </IconButton>
          <IconButton variant="ghost" size="sm" tooltip="Search Messages" onClick={() => setSearchOpen((v) => !v)}>
            <Search size={16} />
          </IconButton>
          <IconButton variant="ghost" size="sm" tooltip="Toggle Member List" onClick={() => useUiStore.getState().toggleMemberList()}>
            <Users size={16} />
          </IconButton>
        </div>
      </div>

      <AnimatePresence>
        {searchOpen && (
          <SearchPanel serverId={sid} onNavigate={handleSearchNavigate} onClose={() => setSearchOpen(false)} />
        )}
      </AnimatePresence>

      <MessageList
        messages={messages}
        hasMore={hasMore}
        onLoadMore={loadOlderMessages}
        onEdit={editMessage}
        onDelete={deleteMessage}
        onReact={toggleReaction}
        onPin={pinMessage}
        onUnpin={unpinMessage}
        onMarkRead={markRead}
      />

      <div className="shrink-0 border-t-2 border-primary">
        <TypingIndicator channelId={channelId} typingUsers={typingUsers} />
        <MessageInput channelId={channelId} onSend={sendMessage} serverId={sid} />
      </div>

      <PinnedMessages channelId={channelId} open={pinsOpen} onClose={() => setPinsOpen(false)} />
    </div>
  );
}
