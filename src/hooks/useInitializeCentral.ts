import { useEffect } from 'react';
import {
  useAuthStore,
  useServerStore,
  useConnectionStore,
  useUiStore,
  connectionManager,
  getStoredServerSessions,
  updateStoredServerMeta,
  toServerUrl,
} from 'ecto-core';

/**
 * Central-authenticated initialization.
 *
 * The active server is connected from cache in parallel with the Central WS +
 * servers.list waterfall so the user sees server content as soon as possible
 * instead of waiting for Central to be fully ready first.
 */
export function useInitializeCentral() {
  const centralAuthState = useAuthStore((s) => s.centralAuthState);

  useEffect(() => {
    if (centralAuthState !== 'authenticated') return;

    const { getToken } = useAuthStore.getState();
    const token = getToken();
    if (!token) return;

    (async () => {
      // ── Phase 1: Pre-populate sidebar from cache for instant render ──
      const cached = await getStoredServerSessions();
      const sortedCached = [...cached].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      for (const session of sortedCached) {
        if (session.serverName) {
          useServerStore.getState().addServer({
            id: session.id,
            server_address: session.address,
            server_name: session.serverName,
            server_icon: session.serverIcon ?? null,
            position: session.position ?? 0,
            joined_at: '',
          });
          // Set 'connecting' immediately so servers don't flash as offline
          useConnectionStore.getState().setStatus(session.id, 'connecting');
        }
      }

      // ── Phase 2: Start active server from cache (parallel with Central) ──
      const savedServerId = useUiStore.getState().activeServerId;
      const savedChannelId = useUiStore.getState().activeChannelId;
      const activeSession = (savedServerId
        ? cached.find((s) => s.id === savedServerId)
        : undefined) ?? cached[0];

      const earlyConnectPromise = activeSession
        ? connectionManager.connectToServer(
            activeSession.id,
            activeSession.address,
            token,
            { openMainWs: true, activeChannelId: savedChannelId },
          ).then(({ realServerId, serverName, serverIcon }) => {
            if (realServerId !== activeSession.id) {
              useConnectionStore.getState().removeConnection(activeSession.id);
              useServerStore.getState().removeServer(activeSession.id);
            }
            useServerStore.getState().addServer({
              id: realServerId,
              server_address: activeSession.address,
              server_name: serverName ?? activeSession.serverName ?? activeSession.address,
              server_icon: serverIcon ?? activeSession.serverIcon ?? null,
              position: 0,
              joined_at: '',
            });
            if (serverName) {
              useServerStore.getState().updateServer(realServerId, {
                server_name: serverName,
                server_icon: serverIcon ?? null,
              });
            }
            useUiStore.getState().setActiveServer(realServerId);
            return { realServerId, address: activeSession.address };
          }).catch(() => null as null)
        : Promise.resolve(null as null);

      // ── Phase 3: Initialize Central WS (parallel with active server) ──
      await connectionManager.initialize(
        useAuthStore.getState().centralUrl,
        () => useAuthStore.getState().token,
      );
      const centralTrpc = connectionManager.getCentralTrpc();
      if (!centralTrpc) return;

      // Fetch server list + wait for early connect to settle
      const [servers, earlyResult] = await Promise.all([
        centralTrpc.servers.list.query(),
        earlyConnectPromise,
      ]);

      // Sync positions from servers.list into cache so next reload has correct order
      for (const s of servers) {
        updateStoredServerMeta(s.id, { position: s.position }).catch(() => {});
      }

      // ── Phase 4: If early connect failed, try from servers.list ──
      let activeAddress: string | null = earlyResult?.address ?? null;

      if (!earlyResult) {
        const activeServer = (savedServerId
          ? servers.find((s) => s.id === savedServerId)
          : undefined) ?? servers[0];

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
            activeAddress = activeServer.server_address;
            useUiStore.getState().setActiveServer(realServerId);
          } catch {
            useServerStore.getState().addServer(activeServer);
            useConnectionStore.getState().setStatus(activeServer.id, 'disconnected');
            activeAddress = activeServer.server_address;
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
      }

      // ── Phase 5: Connect background servers (staggered, fire-and-forget) ──
      const backgroundServers = servers.filter(
        (s) => !activeAddress || toServerUrl(s.server_address) !== activeAddress,
      );

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
            // Rebuild sidebar order from position values after all connections settle
            useServerStore.getState().rebuildOrder();
          });
        }, 100);
      } else {
        // No background servers — still rebuild order for the active server
        useServerStore.getState().rebuildOrder();
      }

      // If nothing connected, set first server as active
      if (!activeAddress && servers.length > 0 && servers[0]) {
        useUiStore.getState().setActiveServer(servers[0].id);
      }
    })().catch((err) => {
      console.warn('[central] Connection initialization failed:', err);
    });
  }, [centralAuthState]);
}
