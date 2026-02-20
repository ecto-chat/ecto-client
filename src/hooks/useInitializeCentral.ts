import { useEffect } from 'react';
import { useAuthStore } from '../stores/auth.js';
import { useServerStore } from '../stores/server.js';
import { useConnectionStore } from '../stores/connection.js';
import { useUiStore } from '../stores/ui.js';
import { connectionManager } from '../services/connection-manager.js';

/**
 * Central-authenticated initialization: connect Central WS,
 * list servers from Central, connect all in parallel.
 */
export function useInitializeCentral() {
  const centralAuthState = useAuthStore((s) => s.centralAuthState);

  useEffect(() => {
    if (centralAuthState !== 'authenticated') return;

    const { getToken } = useAuthStore.getState();
    const token = getToken();
    if (!token) return;

    connectionManager.initialize(useAuthStore.getState().centralUrl, () => useAuthStore.getState().token).then(async () => {
      const centralTrpc = connectionManager.getCentralTrpc();
      if (!centralTrpc) return;
      try {
        const servers = await centralTrpc.servers.list.query();

        const results = await Promise.allSettled(
          servers.map(async (server) => {
            const realId = await connectionManager.connectToServer(
              server.server_address,
              server.server_address,
              token,
            );
            if (realId !== server.id) {
              useConnectionStore.getState().removeConnection(server.id);
              useServerStore.getState().removeServer(server.id);
            }
            useServerStore.getState().addServer({ ...server, id: realId });

            const trpc = connectionManager.getServerTrpc(realId);
            if (trpc) {
              trpc.server.info.query().then((info) => {
                const srv = info as unknown as { server: { name?: string; icon_url?: string } };
                useServerStore.getState().updateServer(realId, {
                  server_name: srv.server.name ?? server.server_address,
                  server_icon: srv.server.icon_url ?? null,
                });
              }).catch(() => {});
            }

            return { server, realId };
          }),
        );

        const realIds: string[] = [];
        for (const result of results) {
          if (result.status === 'fulfilled') {
            realIds.push(result.value.realId);
          } else {
            const idx = results.indexOf(result);
            const server = servers[idx]!;
            useServerStore.getState().addServer(server);
            useConnectionStore.getState().setStatus(server.id, 'disconnected');
            connectionManager.startServerRetry(server.server_address, (realId) => {
              if (realId !== server.id) {
                useConnectionStore.getState().removeConnection(server.id);
                useServerStore.getState().removeServer(server.id);
              }
              useServerStore.getState().addServer({ ...server, id: realId });
              const trpc = connectionManager.getServerTrpc(realId);
              if (trpc) {
                trpc.server.info.query().then((info) => {
                  const srv = info as unknown as { server: { name?: string; icon_url?: string } };
                  useServerStore.getState().updateServer(realId, {
                    server_name: srv.server.name ?? server.server_address,
                    server_icon: srv.server.icon_url ?? null,
                  });
                }).catch(() => {});
              }
              const current = useUiStore.getState().activeServerId;
              if (!current || current === server.id) {
                useUiStore.getState().setActiveServer(realId);
                connectionManager.switchServer(realId).catch(() => {});
              }
            });
          }
        }

        const savedServerId = useUiStore.getState().activeServerId;
        if (savedServerId && realIds.includes(savedServerId)) {
          connectionManager.switchServer(savedServerId).catch(() => {});
        } else if (realIds.length > 0) {
          useUiStore.getState().setActiveServer(realIds[0]!);
          connectionManager.switchServer(realIds[0]!).catch(() => {});
        }
      } catch (err) {
        console.warn('[central] Failed to initialize servers:', err);
      }
    }).catch((err) => {
      console.warn('[central] Connection initialization failed:', err);
    });
  }, [centralAuthState]);
}
