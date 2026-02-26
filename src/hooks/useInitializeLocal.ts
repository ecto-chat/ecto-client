import { useEffect } from 'react';
import { useAuthStore } from '../stores/auth.js';
import { useServerStore } from '../stores/server.js';
import { useConnectionStore } from '../stores/connection.js';
import { useUiStore } from '../stores/ui.js';
import { connectionManager } from '../services/connection-manager.js';

/**
 * Local-only initialization: load stored server sessions from
 * secure storage and connect to all in parallel.
 */
export function useInitializeLocal() {
  const centralAuthState = useAuthStore((s) => s.centralAuthState);

  useEffect(() => {
    if (centralAuthState !== 'unauthenticated') return;

    connectionManager.getStoredServerSessions().then((sessions) => connectionManager.initializeLocalOnly().then(() => {
      for (const session of sessions) {
        const connected = connectionManager.getServerConnection(session.id) !== null;
        useServerStore.getState().addServer({
          id: session.id,
          server_address: session.address,
          server_name: session.serverName ?? session.address,
          server_icon: session.serverIcon ?? null,
          position: useServerStore.getState().serverOrder.length,
          joined_at: new Date().toISOString(),
        });
        if (!connected) {
          useConnectionStore.getState().setStatus(session.id, 'disconnected');
          connectionManager.startServerRetry(session.address, (realId) => {
            if (realId !== session.id) {
              useConnectionStore.getState().removeConnection(session.id);
              useServerStore.getState().removeServer(session.id);
            }
            useServerStore.getState().addServer({
              id: realId,
              server_address: session.address,
              server_name: session.address,
              server_icon: null,
              position: useServerStore.getState().serverOrder.length,
              joined_at: new Date().toISOString(),
            });
            const current = useUiStore.getState().activeServerId;
            if (!current || current === session.id) {
              useUiStore.getState().setActiveServer(realId);
              connectionManager.switchServer(realId).catch(() => {});
            }
          });
        }
      }

      const savedServerId = useUiStore.getState().activeServerId;
      const connectedIds = sessions.map((s) => s.id).filter((id) =>
        connectionManager.getServerConnection(id) !== null,
      );
      if (savedServerId && connectedIds.includes(savedServerId)) {
        connectionManager.switchServer(savedServerId).catch(() => {});
      } else if (connectedIds.length > 0 && connectedIds[0]) {
        useUiStore.getState().setActiveServer(connectedIds[0]);
        connectionManager.switchServer(connectedIds[0]).catch(() => {});
      }
    })).catch(() => {});
  }, [centralAuthState]);
}
