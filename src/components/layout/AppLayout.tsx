import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
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
import { AddServerModal } from '../servers/AddServerModal.js';

export function AppLayout() {
  const activeServerId = useUiStore((s) => s.activeServerId);
  const memberListVisible = useUiStore((s) => s.memberListVisible);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const voiceServerId = useVoiceStore((s) => s.currentServerId);
  const showVoiceBanner = voiceServerId !== null && voiceServerId !== activeServerId;

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
            // Server unreachable — skip
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
  const isHomeMode = activeServerId === null;

  return (
    <div className="app-layout">
      <ServerSidebar />

      {!sidebarCollapsed && (
        <div className="channel-sidebar-container">
          {isHomeMode ? <DMSidebar /> : <ChannelSidebar />}
          <VoiceControls />
        </div>
      )}

      <main className="main-content">
        {showVoiceBanner && <VoiceBanner />}
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
      </main>

      {!isHomeMode && memberListVisible && <MemberList />}

      <AddServerModal />
    </div>
  );
}
