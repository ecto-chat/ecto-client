import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal.js';
import { Avatar } from '../common/Avatar.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import { useUiStore } from '../../stores/ui.js';
import { useAuthStore } from '../../stores/auth.js';
import { useServerStore } from '../../stores/server.js';
import { connectionManager } from '../../services/connection-manager.js';
import { createServerTrpcClient } from '../../services/trpc.js';

interface ServerInfo {
  name: string;
  description?: string;
  icon_url?: string;
  member_count: number;
  online_count: number;
}

export function ServerPreview() {
  const open = useUiStore((s) => s.activeModal === 'server-preview');
  const modalData = useUiStore((s) => s.modalData) as { address: string } | null;
  const close = () => useUiStore.getState().closeModal();

  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

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
        const realServerId = await connectionManager.connectToServer(modalData.address, modalData.address, token);

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
    <Modal open={open} onClose={close} title="Server Preview">
      {loading ? (
        <div className="server-preview-loading">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="auth-error">{error}</div>
      ) : info ? (
        <div className="server-preview">
          <Avatar src={info.icon_url} username={info.name} size={80} />
          <h3>{info.name}</h3>
          {info.description && <p>{info.description}</p>}
          <div className="server-preview-stats">
            <span>{info.online_count} Online</span>
            <span>{info.member_count} Members</span>
          </div>
          <button onClick={handleJoin} disabled={joining} className="auth-button">
            {joining ? <LoadingSpinner size={18} /> : 'Join Server'}
          </button>
        </div>
      ) : null}
    </Modal>
  );
}
