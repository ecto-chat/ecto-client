import { useEffect } from 'react';
import { useAuthStore } from '../stores/auth.js';
import { useServerStore } from '../stores/server.js';
import { useConnectionStore } from '../stores/connection.js';
import { useUiStore } from '../stores/ui.js';
import { connectionManager } from '../services/connection-manager.js';
import { getStoredServerSessions } from '../services/storage-manager.js';

/**
 * Central-authenticated initialization: connect Central WS,
 * list servers from Central, connect active server first, then background servers.
 */
export function useInitializeCentral() {
  const centralAuthState = useAuthStore((s) => s.centralAuthState);

  useEffect(() => {
    if (centralAuthState !== 'authenticated') return;

    const { getToken } = useAuthStore.getState();
    const token = getToken();
    if (!token) return;

    (async () => {
      // Phase 4.1: Pre-populate sidebar from cached sessions for instant render
      const cached = await getStoredServerSessions();
      for (const session of cached) {
        if (session.serverName) {
          useServerStore.getState().addServer({
            id: session.id,
            server_address: session.address,
            server_name: session.serverName,
            server_icon: session.serverIcon ?? null,
            position: 0,
            joined_at: '',
          });
        }
      }

      await connectionManager.initialize(useAuthStore.getState().centralUrl, () => useAuthStore.getState().token);
      const centralTrpc = connectionManager.getCentralTrpc();
      if (!centralTrpc) return;

      const servers = await centralTrpc.servers.list.query();

      // Determine which server should be the active one
      const savedServerId = useUiStore.getState().activeServerId;
      const savedChannelId = useUiStore.getState().activeChannelId;

      // Find the active server — match by ID first, fallback to first
      const activeServer = (savedServerId
        ? servers.find((s) => s.id === savedServerId)
        : undefined) ?? servers[0];

      const backgroundServers = servers.filter((s) => s !== activeServer);

      // ── Track A: Connect active server (critical path) ──
      let firstActiveId: string | null = null;
      if (activeServer) {
        try {
          const { realServerId, serverName, serverIcon } = await connectionManager.connectToServer(
            activeServer.server_address,
            activeServer.server_address,
            token,
            { openMainWs: true, activeChannelId: savedChannelId },
          );
          if (realServerId !== activeServer.id) {
            useConnectionStore.getState().removeConnection(activeServer.id);
            useServerStore.getState().removeServer(activeServer.id);
          }
          useServerStore.getState().addServer({ ...activeServer, id: realServerId });
          if (serverName) {
            useServerStore.getState().updateServer(realServerId, {
              server_name: serverName,
              server_icon: serverIcon ?? null,
            });
          }
          firstActiveId = realServerId;
          useUiStore.getState().setActiveServer(realServerId);
        } catch {
          useServerStore.getState().addServer(activeServer);
          useConnectionStore.getState().setStatus(activeServer.id, 'disconnected');
          connectionManager.startServerRetry(activeServer.server_address, (realId) => {
            if (realId !== activeServer.id) {
              useConnectionStore.getState().removeConnection(activeServer.id);
              useServerStore.getState().removeServer(activeServer.id);
            }
            useServerStore.getState().addServer({ ...activeServer, id: realId });
            useUiStore.getState().setActiveServer(realId);
            connectionManager.switchServer(realId).catch(() => {});
          });
        }
      }

      // ── Track B: Connect background servers (staggered, fire-and-forget) ──
      if (backgroundServers.length > 0) {
        setTimeout(() => {
          Promise.allSettled(
            backgroundServers.map(async (server) => {
              const { realServerId, serverName, serverIcon } = await connectionManager.connectToServer(
                server.server_address,
                server.server_address,
                token,
                { openMainWs: false },
              );
              if (realServerId !== server.id) {
                useConnectionStore.getState().removeConnection(server.id);
                useServerStore.getState().removeServer(server.id);
              }
              useServerStore.getState().addServer({ ...server, id: realServerId });
              if (serverName) {
                useServerStore.getState().updateServer(realServerId, {
                  server_name: serverName,
                  server_icon: serverIcon ?? null,
                });
              }
            }),
          ).then((results) => {
            // Handle failed background connections
            results.forEach((result, idx) => {
              if (result.status === 'rejected') {
                const server = backgroundServers[idx];
                if (!server) return;
                useServerStore.getState().addServer(server);
                useConnectionStore.getState().setStatus(server.id, 'disconnected');
                connectionManager.startServerRetry(server.server_address, (realId) => {
                  if (realId !== server.id) {
                    useConnectionStore.getState().removeConnection(server.id);
                    useServerStore.getState().removeServer(server.id);
                  }
                  useServerStore.getState().addServer({ ...server, id: realId });
                });
              }
            });
          });
        }, 100);
      }

      // If active server failed, try first background server
      if (!firstActiveId && servers.length > 0 && servers[0]) {
        useUiStore.getState().setActiveServer(servers[0].id);
      }
    })().catch((err) => {
      console.warn('[central] Connection initialization failed:', err);
    });
  }, [centralAuthState]);
}
