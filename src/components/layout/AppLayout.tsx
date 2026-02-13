import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { ServerSidebar } from './ServerSidebar.js';
import { ChannelSidebar } from './ChannelSidebar.js';
import { MemberList } from './MemberList.js';
import { ChannelView } from '../chat/ChannelView.js';
import { FriendList } from '../friends/FriendList.js';
import { DMView } from '../friends/DMView.js';
import { VoiceControls } from '../voice/VoiceControls.js';
import { VoiceBanner } from '../voice/VoiceBanner.js';
import { DMSidebar } from '../friends/DMSidebar.js';
import { useUiStore } from '../../stores/ui.js';
import { useVoiceStore } from '../../stores/voice.js';
import { useAuthStore } from '../../stores/auth.js';
import { useServerStore } from '../../stores/server.js';
import { connectionManager } from '../../services/connection-manager.js';
import { useNotifications } from '../../hooks/useNotifications.js';
import { useConnectionStore } from '../../stores/connection.js';
import { AddServerModal } from '../servers/AddServerModal.js';
import { UserProfileModal } from '../user/UserProfileModal.js';
import { IncomingCallOverlay } from '../call/IncomingCallOverlay.js';
import { ActiveCallOverlay } from '../call/ActiveCallOverlay.js';
import { CallBanner } from '../call/CallBanner.js';
import { useCallStore } from '../../stores/call.js';

export function AppLayout() {
  const activeServerId = useUiStore((s) => s.activeServerId);
  const memberListVisible = useUiStore((s) => s.memberListVisible);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const voiceServerId = useVoiceStore((s) => s.currentServerId);
  const showVoiceBanner = voiceServerId !== null && voiceServerId !== activeServerId;
  const callState = useCallStore((s) => s.callState);

  useNotifications();

  // Initialize connections on mount
  useEffect(() => {
    const { centralUrl, getToken } = useAuthStore.getState();
    const token = getToken();
    if (!token) return;

    connectionManager.initialize(centralUrl, () => useAuthStore.getState().token).then(async () => {
      // Fetch server list and connect
      const centralTrpc = connectionManager.getCentralTrpc();
      if (!centralTrpc) return;
      try {
        const servers = await centralTrpc.servers.list.query();
        // Connect to each server — connectToServer resolves the real UUID
        const realIds: string[] = [];
        for (const server of servers) {
          try {
            const realId = await connectionManager.connectToServer(
              server.server_address,
              server.server_address,
              token,
            );
            realIds.push(realId);
            // Update store entry with real server ID
            useServerStore.getState().addServer({
              ...server,
              id: realId,
            });
          } catch {
            // Server unreachable — add to sidebar with disconnected status + start retry
            useServerStore.getState().addServer(server);
            useConnectionStore.getState().setStatus(server.id, 'disconnected');
            connectionManager.startServerRetry(server.server_address, (realId) => {
              // Clean up stale entries
              if (realId !== server.id) {
                useConnectionStore.getState().removeConnection(server.id);
                useServerStore.getState().removeServer(server.id);
              }
              useServerStore.getState().addServer({ ...server, id: realId });
              // If no active server or was viewing this offline server, switch to it
              const current = useUiStore.getState().activeServerId;
              if (!current || current === server.id) {
                useUiStore.getState().setActiveServer(realId);
                connectionManager.switchServer(realId).catch(() => {});
              }
            });
          }
        }
        // Switch to previously active server (if it resolved to a valid UUID)
        const savedServerId = useUiStore.getState().activeServerId;
        if (savedServerId && realIds.includes(savedServerId)) {
          connectionManager.switchServer(savedServerId).catch(() => {});
        } else if (realIds.length > 0) {
          // Saved ID was stale (e.g. old address string), switch to first server
          useUiStore.getState().setActiveServer(realIds[0]!);
          connectionManager.switchServer(realIds[0]!).catch(() => {});
        }
      } catch {
        // Central unreachable
      }
    }).catch(() => {});
  }, []);

  // Determine whether we're in DM/friends mode or server mode
  const location = useLocation();
  const isHomeRoute = location.pathname.startsWith('/dms') || location.pathname.startsWith('/friends');
  const isHomeMode = isHomeRoute || activeServerId === null;

  // Check if active server is offline
  const activeServerStatus = useConnectionStore((s) =>
    activeServerId ? s.connections.get(activeServerId) : undefined,
  );
  const isServerOffline = !isHomeMode && activeServerId && (!activeServerStatus || activeServerStatus === 'disconnected');

  return (
    <div className="app-layout">
      <ServerSidebar />

      {!sidebarCollapsed && !isServerOffline && (
        <div className="channel-sidebar-container">
          {isHomeMode ? <DMSidebar /> : <ChannelSidebar />}
          <VoiceControls />
        </div>
      )}

      <main className="main-content">
        {showVoiceBanner && <VoiceBanner />}
        {callState === 'active' && <CallBanner />}
        {isServerOffline ? (
          <div className="server-offline-view">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="server-offline-view-icon">
              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4C9.11 4 6.6 5.64 5.35 8.04C2.34 8.36 0 10.91 0 14C0 17.31 2.69 20 6 20H19C21.76 20 24 17.76 24 15C24 12.36 21.95 10.22 19.35 10.04Z" fill="currentColor" opacity="0.3"/>
              <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <h2>Server is offline</h2>
            <p>Please contact the server admin to bring it back online.</p>
          </div>
        ) : (
          <Routes>
            <Route path="friends" element={<FriendList />} />
            <Route path="dms/:userId" element={<DMView />} />
            <Route path="servers/:serverId/channels/:channelId" element={<ChannelView />} />
            <Route
              path="*"
              element={
                isHomeMode ? <FriendList /> : <div className="no-channel-selected">Select a channel</div>
              }
            />
          </Routes>
        )}
      </main>

      {!isHomeMode && !isServerOffline && memberListVisible && <MemberList />}

      <AddServerModal />
      <UserProfileModal />
      <IncomingCallOverlay />
      <ActiveCallOverlay />
    </div>
  );
}
