import { useState, useCallback } from 'react';

import { ConfirmDialog } from '@/ui';
import { useUiStore } from '@/stores/ui';
import { useServerStore } from '@/stores/server';
import { connectionManager } from '@/services/connection-manager';

export function LeaveServerModal() {
  const open = useUiStore((s) => s.activeModal === 'leave-server');
  const modalData = useUiStore((s) => s.modalData) as { serverId: string; serverName: string } | null;
  const [loading, setLoading] = useState(false);

  const close = useCallback(() => useUiStore.getState().closeModal(), []);

  const handleLeave = useCallback(async () => {
    if (!modalData?.serverId) return;
    setLoading(true);

    try {
      const trpc = connectionManager.getServerTrpc(modalData.serverId);
      if (trpc) {
        await trpc.server.leave.mutate();
      }

      const server = useServerStore.getState().servers.get(modalData.serverId);
      const centralTrpc = connectionManager.getCentralTrpc();
      if (centralTrpc && server?.server_address) {
        centralTrpc.servers.remove.mutate({ server_address: server.server_address }).catch((err: unknown) => {
          console.warn('[central] Failed to sync server removal:', err);
        });
      }

      connectionManager.disconnectFromServer(modalData.serverId);
      await connectionManager.removeStoredServerSession(modalData.serverId);
      useServerStore.getState().removeServer(modalData.serverId);
      useUiStore.getState().setActiveServer(null);
      close();
    } catch {
      setLoading(false);
    }
  }, [modalData, close]);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(v) => { if (!v) close(); }}
      title="Leave Server"
      description={`Are you sure you want to leave ${modalData?.serverName ?? 'this server'}? You won't be able to rejoin unless you are re-invited.`}
      confirmLabel="Leave Server"
      cancelLabel="Cancel"
      variant="danger"
      onConfirm={handleLeave}
      loading={loading}
    />
  );
}
