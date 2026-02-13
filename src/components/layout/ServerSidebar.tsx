import { useNavigate } from 'react-router-dom';
import { useServerStore } from '../../stores/server.js';
import { useUiStore } from '../../stores/ui.js';
import { useNotifyStore } from '../../stores/notify.js';
import { useReadStateStore } from '../../stores/read-state.js';
import { useConnectionStore } from '../../stores/connection.js';
import { connectionManager } from '../../services/connection-manager.js';
import { Avatar } from '../common/Avatar.js';

export function ServerSidebar() {
  const serverOrder = useServerStore((s) => s.serverOrder);
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useUiStore((s) => s.activeServerId);
  const notifications = useNotifyStore((s) => s.notifications);
  const mentionCounts = useReadStateStore((s) => s.mentionCounts);
  const connections = useConnectionStore((s) => s.connections);
  const navigate = useNavigate();

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
    </div>
  );
}
