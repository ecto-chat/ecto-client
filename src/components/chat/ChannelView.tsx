import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { MessageList } from './MessageList.js';
import { MessageInput } from './MessageInput.js';
import { TypingIndicator } from './TypingIndicator.js';
import { VoiceView } from '../voice/VoiceView.js';
import { useMessages } from '../../hooks/useMessages.js';
import { useChannels } from '../../hooks/useChannels.js';
import { useUiStore } from '../../stores/ui.js';
import { useChannelStore } from '../../stores/channel.js';

export function ChannelView() {
  const { channelId, serverId } = useParams<{ channelId: string; serverId: string }>();
  const activeServerId = useUiStore((s) => s.activeServerId);
  const sid = serverId ?? activeServerId ?? '';
  const channel = useChannelStore((s) => s.channels.get(sid)?.get(channelId ?? ''));
  const { openChannel, closeChannel } = useChannels(sid);
  const {
    messages,
    hasMore,
    typingUsers,
    loadMessages,
    loadOlderMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    pinMessage,
    unpinMessage,
    markRead,
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

    // Mark as read after short delay
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

  if (!channelId || !channel) {
    return <div className="channel-view-empty">Select a channel</div>;
  }

  if (channel.type === 'voice') {
    return <VoiceView />;
  }

  return (
    <div className="channel-view">
      <div className="channel-header">
        <span className="channel-header-prefix">#</span>
        <span className="channel-header-name">{channel.name}</span>
        {channel.topic && <span className="channel-header-topic">{channel.topic}</span>}
        <div className="channel-header-actions">
          <button
            className="icon-btn"
            onClick={() => useUiStore.getState().toggleMemberList()}
            title="Toggle Member List"
          >
            &#128101;
          </button>
        </div>
      </div>

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

      <div className="channel-input-area">
        <TypingIndicator channelId={channelId} typingUsers={typingUsers} />
        <MessageInput channelId={channelId} onSend={sendMessage} serverId={sid} />
      </div>
    </div>
  );
}
