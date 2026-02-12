import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChannels } from '../../hooks/useChannels.js';
import { useUiStore } from '../../stores/ui.js';
import { useServerStore } from '../../stores/server.js';
import { useReadStateStore } from '../../stores/read-state.js';
import { useVoiceStore } from '../../stores/voice.js';
import { VoiceChannel } from '../voice/VoiceChannel.js';
import type { Channel } from 'ecto-shared';

export function ChannelSidebar() {
  const activeServerId = useUiStore((s) => s.activeServerId);
  const activeChannelId = useUiStore((s) => s.activeChannelId);
  const server = useServerStore((s) => (activeServerId ? s.servers.get(activeServerId) : undefined));
  const { channels, categories, openChannel } = useChannels(activeServerId ?? '');
  const unreadCounts = useReadStateStore((s) => s.unreadCounts);
  const mentionCounts = useReadStateStore((s) => s.mentionCounts);
  const [collapsedCategories, setCollapsedCategories] = useState(new Set<string>());
  const navigate = useNavigate();

  const handleChannelClick = useCallback(
    (channel: Channel) => {
      if (channel.type === 'voice') return; // Voice channel clicks handled by VoiceChannel component
      useUiStore.getState().setActiveChannel(channel.id);
      openChannel(channel.id);
      navigate(`/servers/${activeServerId}/channels/${channel.id}`);
    },
    [activeServerId, openChannel, navigate],
  );

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  // Group channels by category
  const uncategorized: Channel[] = [];
  const categorized = new Map<string, Channel[]>();

  for (const channel of channels) {
    const catId = channel.category_id;
    if (!catId) {
      uncategorized.push(channel);
    } else {
      const list = categorized.get(catId) ?? [];
      list.push(channel);
      categorized.set(catId, list);
    }
  }

  return (
    <div className="channel-sidebar">
      <div className="channel-sidebar-header">
        <h2>{server?.server_name ?? 'Server'}</h2>
      </div>

      <div className="channel-list">
        {/* Uncategorized channels */}
        {uncategorized.map((ch) => (
          <ChannelItem
            key={ch.id}
            channel={ch}
            isActive={ch.id === activeChannelId}
            unread={unreadCounts.get(ch.id) ?? 0}
            mentions={mentionCounts.get(ch.id) ?? 0}
            onClick={handleChannelClick}
          />
        ))}

        {/* Categorized channels */}
        {[...categories.entries()].map(([catId, category]) => {
          const catChannels = categorized.get(catId) ?? [];
          const isCollapsed = collapsedCategories.has(catId);

          return (
            <div key={catId} className="channel-category">
              <div className="category-header" onClick={() => toggleCategory(catId)}>
                <span className={`category-arrow ${isCollapsed ? 'collapsed' : ''}`}>&#9662;</span>
                <span className="category-name">{category.name}</span>
              </div>
              {!isCollapsed &&
                catChannels.map((ch) => (
                  <ChannelItem
                    key={ch.id}
                    channel={ch}
                    isActive={ch.id === activeChannelId}
                    unread={unreadCounts.get(ch.id) ?? 0}
                    mentions={mentionCounts.get(ch.id) ?? 0}
                    onClick={handleChannelClick}
                  />
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChannelItem({
  channel,
  isActive,
  unread,
  mentions,
  onClick,
}: {
  channel: Channel;
  isActive: boolean;
  unread: number;
  mentions: number;
  onClick: (channel: Channel) => void;
}) {
  if (channel.type === 'voice') {
    return <VoiceChannel channel={channel} isActive={isActive} />;
  }

  const prefix = channel.type === 'text' ? '#' : '#';

  return (
    <div
      className={`channel-item ${isActive ? 'active' : ''} ${unread > 0 ? 'unread' : ''}`}
      onClick={() => onClick(channel)}
    >
      <span className="channel-prefix">{prefix}</span>
      <span className="channel-name">{channel.name}</span>
      {mentions > 0 && <span className="channel-mention-badge">{mentions}</span>}
    </div>
  );
}
