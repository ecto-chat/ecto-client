import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useServerStore } from '../../stores/server.js';
import { useUiStore } from '../../stores/ui.js';
import { useNotifyStore } from '../../stores/notify.js';
import { useReadStateStore } from '../../stores/read-state.js';
import { useConnectionStore } from '../../stores/connection.js';
import { connectionManager } from '../../services/connection-manager.js';
import { fullLogout } from '../../stores/reset.js';
import { Avatar } from '../common/Avatar.js';

interface ContextMenu {
  x: number;
  y: number;
  serverId: string;
}

export function ServerSidebar() {
  const serverOrder = useServerStore((s) => s.serverOrder);
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useUiStore((s) => s.activeServerId);
  const notifications = useNotifyStore((s) => s.notifications);
  const mentionCounts = useReadStateStore((s) => s.mentionCounts);
  const connections = useConnectionStore((s) => s.connections);
  const navigate = useNavigate();
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

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
    connectionManager.removeStoredServerSession(serverId);
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

  const getServerUnread = (serverId: string): boolean => {
    const serverNotifs = notifications.get(serverId);
    return serverNotifs !== undefined && serverNotifs.size > 0;
  };

  const getServerMentions = (serverId: string): number => {
    let total = 0;
    for (const [, count] of mentionCounts) {
      // This is an approximation - ideally we'd track which channels belong to which server
      total += count;
    }
    return total;
  };

  const menuServerStatus = contextMenu ? connections.get(contextMenu.serverId) : undefined;
  const menuServerOffline = contextMenu && (!menuServerStatus || menuServerStatus === 'disconnected');

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
      {serverOrder.map((serverId) => {
        const server = servers.get(serverId);
        if (!server) return null;
        const isActive = activeServerId === serverId;
        const hasUnread = getServerUnread(serverId);
        const status = connections.get(serverId);
        const isOffline = !status || status === 'disconnected';

        return (
          <div key={serverId} className="server-icon-wrapper">
            {hasUnread && !isActive && <div className="server-unread-dot" />}
            <div
              className={`server-icon ${isActive ? 'active' : ''} ${isOffline ? 'offline' : ''}`}
              onClick={() => handleServerClick(serverId)}
              onContextMenu={(e) => handleContextMenu(e, serverId)}
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
      })}

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
      {contextMenu && createPortal(
        <div
          className="server-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="server-context-menu-item"
            onClick={handleLeaveServer}
          >
            Leave Server
          </button>
          {menuServerOffline && (
            <button
              className="server-context-menu-item danger"
              onClick={handleRemoveServer}
            >
              Remove Server
            </button>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
