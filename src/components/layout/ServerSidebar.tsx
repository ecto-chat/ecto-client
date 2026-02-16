import { useState, useEffect, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useServerStore } from '../../stores/server.js';
import { useUiStore } from '../../stores/ui.js';
import { useNotifyStore } from '../../stores/notify.js';
import { useReadStateStore } from '../../stores/read-state.js';
import { useConnectionStore } from '../../stores/connection.js';
import { useChannelStore } from '../../stores/channel.js';
import { connectionManager } from '../../services/connection-manager.js';
import { fullLogout } from '../../stores/reset.js';
import { Avatar } from '../common/Avatar.js';
import type { ServerListEntry } from 'ecto-shared';

interface ContextMenu {
  x: number;
  y: number;
  serverId: string;
}

function SortableServerIcon({ children, id }: { children: React.ReactNode; id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export function ServerSidebar() {
  const serverOrder = useServerStore((s) => s.serverOrder);
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useUiStore((s) => s.activeServerId);
  const navigate = useNavigate();
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleServerDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = serverOrder.indexOf(active.id as string);
    const newIndex = serverOrder.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove([...serverOrder], oldIndex, newIndex);
    useServerStore.getState().reorderServers(newOrder);
  };

  // Close context menu on outside click or another context menu
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    document.addEventListener('contextmenu', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('contextmenu', close);
    };
  }, [contextMenu]);

  const handleHomeClick = () => {
    useUiStore.getState().setActiveServer(null);
    useUiStore.getState().setActiveChannel(null);
    navigate('/friends');
  };

  const handleServerClick = (serverId: string) => {
    useUiStore.getState().setActiveServer(serverId);
    useUiStore.getState().setActiveChannel(null);
    connectionManager.switchServer(serverId).catch(() => {});
    navigate(`/servers/${serverId}/channels`);
  };

  const handleAddServer = () => {
    useUiStore.getState().openModal('add-server');
  };

  const handleContextMenu = (e: React.MouseEvent, serverId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, serverId });
  };

  const handleLeaveServer = () => {
    if (!contextMenu) return;
    const server = servers.get(contextMenu.serverId);
    useUiStore.getState().openModal('leave-server', {
      serverId: contextMenu.serverId,
      serverName: server?.server_name ?? contextMenu.serverId,
    });
    setContextMenu(null);
  };

  const handleMarkAllRead = () => {
    if (!contextMenu) return;
    const serverChannels = useChannelStore.getState().channels.get(contextMenu.serverId);
    if (serverChannels) {
      useReadStateStore.getState().markAllRead([...serverChannels.keys()]);
    }
    useNotifyStore.getState().clearNotifications(contextMenu.serverId);
    // Persist to server
    const trpc = connectionManager.getServerTrpc(contextMenu.serverId);
    trpc?.read_state.markAllRead.mutate().catch(() => {});
    setContextMenu(null);
  };

  const handleToggleMuteServer = () => {
    if (!contextMenu) return;
    useNotifyStore.getState().toggleMuteServer(contextMenu.serverId);
    setContextMenu(null);
  };

  const handleRemoveServer = () => {
    if (!contextMenu) return;
    const { serverId } = contextMenu;
    const server = servers.get(serverId);

    // Remove from Central server list (Path A) so it doesn't reappear on refresh
    const centralTrpc = connectionManager.getCentralTrpc();
    if (centralTrpc && server?.server_address) {
      centralTrpc.servers.remove.mutate({ server_address: server.server_address }).catch(() => {});
    }

    connectionManager.disconnectFromServer(serverId);
    connectionManager.removeStoredServerSession(serverId).catch(() => {});
    connectionManager.stopServerRetry(
      server?.server_address ?? serverId,
    );
    useServerStore.getState().removeServer(serverId);
    if (useUiStore.getState().activeServerId === serverId) {
      useUiStore.getState().setActiveServer(null);
      navigate('/friends');
    }
    setContextMenu(null);
  };

  const handleServerClickCb = useCallback((serverId: string) => handleServerClick(serverId), []);
  const handleContextMenuCb = useCallback((e: React.MouseEvent, serverId: string) => handleContextMenu(e, serverId), []);

  return (
    <div className="server-sidebar">
      {/* Home button */}
      <div
        className={`server-icon home-icon ${activeServerId === null ? 'active' : ''}`}
        onClick={handleHomeClick}
        title="Home"
      >
        <svg width="28" height="20" viewBox="0 0 28 20">
          <path fill="currentColor" d="M23.0212 1.67671C21.7831 0.517824 19.7019 0.517824 18.4639 1.67671L14 5.84468L9.53618 1.67671C8.29806 0.517824 6.21692 0.517824 4.97879 1.67671L0 6.39879V20H8V13H20V20H28V6.39879L23.0212 1.67671Z" />
        </svg>
      </div>

      <div className="server-sidebar-separator" />

      {/* Server list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleServerDragEnd}>
        <SortableContext items={serverOrder} strategy={verticalListSortingStrategy}>
          {serverOrder.map((serverId) => {
            const server = servers.get(serverId);
            if (!server) return null;
            return (
              <SortableServerIcon key={serverId} id={serverId}>
                <ServerIconItem
                  serverId={serverId}
                  server={server}
                  isActive={activeServerId === serverId}
                  onClick={handleServerClickCb}
                  onContextMenu={handleContextMenuCb}
                />
              </SortableServerIcon>
            );
          })}
        </SortableContext>
      </DndContext>

      {/* Add server button */}
      <div className="server-icon add-server" onClick={handleAddServer} title="Add a Server">
        <span>+</span>
      </div>

      <div className="server-sidebar-spacer" />

      {/* Sign out button */}
      <div
        className="server-icon sign-out-icon"
        onClick={() => {
          fullLogout().then(() => {
            navigate('/landing');
          });
        }}
        title="Sign Out"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="16,17 21,12 16,7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ServerContextMenuPortal
          contextMenu={contextMenu}
          onMarkAllRead={handleMarkAllRead}
          onToggleMute={handleToggleMuteServer}
          onLeaveServer={handleLeaveServer}
          onRemoveServer={handleRemoveServer}
        />
      )}
    </div>
  );
}

/** Memoized server icon — per-item store selectors prevent re-renders from other servers. */
const ServerIconItem = memo(function ServerIconItem({
  serverId,
  server,
  isActive,
  onClick,
  onContextMenu,
}: {
  serverId: string;
  server: ServerListEntry;
  isActive: boolean;
  onClick: (serverId: string) => void;
  onContextMenu: (e: React.MouseEvent, serverId: string) => void;
}) {
  const hasUnread = useNotifyStore((s) => {
    const serverNotifs = s.notifications.get(serverId);
    return serverNotifs !== undefined && serverNotifs.size > 0;
  });
  const isMuted = useNotifyStore((s) => s.mutedServers.has(serverId));
  const status = useConnectionStore((s) => s.connections.get(serverId));
  const isOffline = !status || status === 'disconnected';

  // Sum mention counts for this server's channels
  const mentions = useReadStateStore((s) => {
    const serverChannels = useChannelStore.getState().channels.get(serverId);
    if (!serverChannels) return 0;
    let total = 0;
    for (const channelId of serverChannels.keys()) {
      total += s.mentionCounts.get(channelId) ?? 0;
    }
    return total;
  });

  return (
    <div className="server-icon-wrapper">
      {hasUnread && !isActive && <div className={`server-unread-dot ${isMuted ? 'muted' : ''}`} />}
      {mentions > 0 && <span className="server-mention-badge">{mentions}</span>}
      {isMuted && <div className="server-muted-icon" title="Muted">&#128263;</div>}
      <div
        className={`server-icon ${isActive ? 'active' : ''} ${isOffline ? 'offline' : ''}`}
        onClick={() => onClick(serverId)}
        onContextMenu={(e) => onContextMenu(e, serverId)}
        title={isOffline ? `${server.server_name ?? serverId} (Offline)` : server.server_name ?? serverId}
      >
        {isOffline ? (
          <div className="server-offline-icon" title="Server Offline">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4C9.11 4 6.6 5.64 5.35 8.04C2.34 8.36 0 10.91 0 14C0 17.31 2.69 20 6 20H19C21.76 20 24 17.76 24 15C24 12.36 21.95 10.22 19.35 10.04Z" fill="currentColor" opacity="0.3"/>
              <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
        ) : (
          <Avatar
            src={server.server_icon ?? undefined}
            username={server.server_name ?? serverId}
            size={48}
          />
        )}
      </div>
    </div>
  );
});

function ServerContextMenuPortal({
  contextMenu,
  onMarkAllRead,
  onToggleMute,
  onLeaveServer,
  onRemoveServer,
}: {
  contextMenu: ContextMenu;
  onMarkAllRead: () => void;
  onToggleMute: () => void;
  onLeaveServer: () => void;
  onRemoveServer: () => void;
}) {
  const status = useConnectionStore((s) => s.connections.get(contextMenu.serverId));
  const isOffline = !status || status === 'disconnected';
  const isMuted = useNotifyStore((s) => s.mutedServers.has(contextMenu.serverId));

  return createPortal(
    <div
      className="server-context-menu"
      style={{ top: contextMenu.y, left: contextMenu.x }}
    >
      <button className="server-context-menu-item" onClick={onMarkAllRead}>
        Mark All as Read
      </button>
      <button className="server-context-menu-item" onClick={onToggleMute}>
        {isMuted ? 'Unmute Server' : 'Mute Server'}
      </button>
      <div className="server-context-menu-separator" />
      <button className="server-context-menu-item" onClick={onLeaveServer}>
        Leave Server
      </button>
      {isOffline && (
        <button className="server-context-menu-item danger" onClick={onRemoveServer}>
          Remove Server
        </button>
      )}
    </div>,
    document.body,
  );
}
