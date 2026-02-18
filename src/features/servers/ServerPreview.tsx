import { useState, useEffect } from 'react';

import { Users, Wifi } from 'lucide-react';

import { Modal, Avatar, Button, Spinner } from '@/ui';
import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';
import { useServerStore } from '@/stores/server';
import { connectionManager } from '@/services/connection-manager';
import { createServerTrpcClient } from '@/services/trpc';

type ServerInfo = {
  name: string;
  description?: string;
  icon_url?: string;
  member_count: number;
  online_count: number;
};

export function ServerPreview() {
  const open = useUiStore((s) => s.activeModal === 'server-preview');
  const modalData = useUiStore((s) => s.modalData) as { address: string } | null;

  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const close = () => useUiStore.getState().closeModal();

  useEffect(() => {
    if (!open || !modalData?.address) return;
    setLoading(true);
    setError('');

    const trpc = createServerTrpcClient(modalData.address, () => null);
    trpc.server.info.query({})
      .then((result) => setInfo(result as unknown as ServerInfo))
      .catch(() => setError('Could not reach server'))
      .finally(() => setLoading(false));
  }, [open, modalData?.address]);

  const handleJoin = async () => {
    if (!modalData?.address) return;
    setJoining(true);
    try {
      const centralTrpc = connectionManager.getCentralTrpc();
      if (!centralTrpc) throw new Error('Not connected');
      await centralTrpc.servers.add.mutate({ server_address: modalData.address });

      const token = useAuthStore.getState().getToken();
      if (token) {
        const realServerId = await connectionManager.connectToServer(
          modalData.address, modalData.address, token,
        );
        await centralTrpc.servers.add.mutate({ server_address: modalData.address }).catch(() => {});

        useServerStore.getState().addServer({
          id: realServerId,
          server_address: modalData.address,
          server_name: info?.name ?? modalData.address,
          server_icon: info?.icon_url ?? null,
          position: useServerStore.getState().serverOrder.length,
          joined_at: new Date().toISOString(),
        });
      }
      close();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setJoining(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={(v) => { if (!v) close(); }} title="Server Preview">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : info ? (
        <div className="flex flex-col items-center gap-4 py-2">
          <Avatar src={info.icon_url} username={info.name} size={80} />
          <h3 className="text-lg text-primary">{info.name}</h3>
          {info.description && <p className="text-sm text-secondary text-center">{info.description}</p>}
          <div className="flex items-center gap-4 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Wifi size={14} />
              {info.online_count} Online
            </span>
            <span className="inline-flex items-center gap-1">
              <Users size={14} />
              {info.member_count} Members
            </span>
          </div>
          <Button onClick={handleJoin} loading={joining} className="mt-2 w-full">
            Join Server
          </Button>
        </div>
      ) : null}
    </Modal>
  );
}
