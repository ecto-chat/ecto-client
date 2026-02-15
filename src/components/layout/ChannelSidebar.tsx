import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useChannels } from '../../hooks/useChannels.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useUiStore } from '../../stores/ui.js';
import { useAuthStore } from '../../stores/auth.js';
import { useServerStore } from '../../stores/server.js';
import { useReadStateStore } from '../../stores/read-state.js';
import { useNotifyStore } from '../../stores/notify.js';
import { useVoiceStore } from '../../stores/voice.js';
import { VoiceChannel } from '../voice/VoiceChannel.js';
import { Avatar } from '../common/Avatar.js';
import type { Channel } from 'ecto-shared';

interface ChannelContextMenu {
  x: number;
  y: number;
  channelId: string;
}

export function ChannelSidebar() {
  const activeServerId = useUiStore((s) => s.activeServerId);
  const activeChannelId = useUiStore((s) => s.activeChannelId);
  const server = useServerStore((s) => (activeServerId ? s.servers.get(activeServerId) : undefined));
  const user = useAuthStore((s) => s.user);
  const { channels, categories, openChannel } = useChannels(activeServerId ?? '');
  const unreadCounts = useReadStateStore((s) => s.unreadCounts);
  const mentionCounts = useReadStateStore((s) => s.mentionCounts);
  const [collapsedCategories, setCollapsedCategories] = useState(new Set<string>());
  const mutedChannels = useNotifyStore((s) => s.mutedChannels);
  const [channelMenu, setChannelMenu] = useState<ChannelContextMenu | null>(null);
  const navigate = useNavigate();
  const { canAccessSettings } = usePermissions(activeServerId);

  // Close channel context menu on outside click
  useEffect(() => {
    if (!channelMenu) return;
    const close = () => setChannelMenu(null);
    document.addEventListener('click', close);
    document.addEventListener('contextmenu', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('contextmenu', close);
    };
  }, [channelMenu]);

  const handleChannelContextMenu = useCallback((e: React.MouseEvent, channelId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setChannelMenu({ x: e.clientX, y: e.clientY, channelId });
  }, []);

  const handleToggleMuteChannel = () => {
    if (!channelMenu) return;
    useNotifyStore.getState().toggleMuteChannel(channelMenu.channelId);
    setChannelMenu(null);
  };

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

  // Setup banner for admin when setup not completed
  const meta = useServerStore((s) => (activeServerId ? s.serverMeta.get(activeServerId) : undefined));
  const showSetupBanner = meta && !meta.setup_completed && meta.admin_user_id && meta.user_id === meta.admin_user_id;

  return (
    <div className="channel-sidebar">
      <div className="channel-sidebar-header">
        <h2>{server?.server_name ?? 'Server'}</h2>
        {canAccessSettings && (
          <button
            className="settings-gear"
            onClick={() => useUiStore.getState().openModal('server-settings')}
            title="Server Settings"
          >
            &#9881;
          </button>
        )}
      </div>

      {showSetupBanner && (
        <div
          className="setup-banner"
          onClick={() => useUiStore.getState().openModal('setup-wizard')}
        >
          Complete Server Setup
        </div>
      )}

      <div className="channel-list">
        {/* Uncategorized channels */}
        {uncategorized.map((ch) => (
          <ChannelItem
            key={ch.id}
            channel={ch}
            isActive={ch.id === activeChannelId}
            unread={unreadCounts.get(ch.id) ?? 0}
            mentions={mentionCounts.get(ch.id) ?? 0}
            isMuted={mutedChannels.has(ch.id)}
            onClick={handleChannelClick}
            onContextMenu={handleChannelContextMenu}
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
                    isMuted={mutedChannels.has(ch.id)}
                    onClick={handleChannelClick}
                    onContextMenu={handleChannelContextMenu}
                  />
                ))}
            </div>
          );
        })}
      </div>

      {/* Channel context menu */}
      {channelMenu && createPortal(
        <div
          className="server-context-menu"
          style={{ top: channelMenu.y, left: channelMenu.x }}
        >
          <button
            className="server-context-menu-item"
            onClick={handleToggleMuteChannel}
          >
            {mutedChannels.has(channelMenu.channelId) ? 'Unmute Channel' : 'Mute Channel'}
          </button>
        </div>,
        document.body,
      )}

      {/* User bar at bottom */}
      <div className="user-bar">
        <Avatar src={user?.avatar_url ?? null} username={user?.username ?? '?'} size={32} />
        <div className="user-bar-info">
          <div className="user-bar-name">{user?.display_name ?? user?.username ?? 'User'}</div>
          <div className="user-bar-status">#{user?.discriminator ?? '0000'}</div>
        </div>
        <button
          className="user-bar-gear"
          onClick={() => useUiStore.getState().openModal('user-settings')}
          title="User Settings"
        >
          &#9881;
        </button>
      </div>
    </div>
  );
}

function ChannelItem({
  channel,
  isActive,
  unread,
  mentions,
  isMuted,
  onClick,
  onContextMenu,
}: {
  channel: Channel;
  isActive: boolean;
  unread: number;
  mentions: number;
  isMuted: boolean;
  onClick: (channel: Channel) => void;
  onContextMenu: (e: React.MouseEvent, channelId: string) => void;
}) {
  if (channel.type === 'voice') {
    return <VoiceChannel channel={channel} isActive={isActive} />;
  }

  const prefix = channel.type === 'text' ? '#' : '#';

  return (
    <div
      className={`channel-item ${isActive ? 'active' : ''} ${unread > 0 ? 'unread' : ''} ${isMuted ? 'muted' : ''}`}
      onClick={() => onClick(channel)}
      onContextMenu={(e) => onContextMenu(e, channel.id)}
    >
      <span className="channel-prefix">{prefix}</span>
      <span className="channel-name">{channel.name}</span>
      {isMuted && <span className="channel-muted-icon" title="Muted">&#128263;</span>}
      {mentions > 0 && <span className="channel-mention-badge">{mentions}</span>}
    </div>
  );
}
