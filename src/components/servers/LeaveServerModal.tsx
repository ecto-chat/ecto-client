import { useState } from 'react';
import { Modal } from '../common/Modal.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import { useUiStore } from '../../stores/ui.js';
import { useServerStore } from '../../stores/server.js';
import { connectionManager } from '../../services/connection-manager.js';

export function LeaveServerModal() {
  const open = useUiStore((s) => s.activeModal === 'leave-server');
  const modalData = useUiStore((s) => s.modalData) as { serverId: string; serverName: string } | null;
  const close = () => useUiStore.getState().closeModal();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLeave = async () => {
    if (!modalData?.serverId) return;
    setLoading(true);
    setError('');

    try {
      const trpc = connectionManager.getServerTrpc(modalData.serverId);
      if (trpc) {
        await trpc.server.leave.mutate();
      }

      // Remove from Central server list (Path A) so it doesn't reappear on refresh
      const server = useServerStore.getState().servers.get(modalData.serverId);
      const centralTrpc = connectionManager.getCentralTrpc();
      if (centralTrpc && server?.server_address) {
        centralTrpc.servers.remove.mutate({ server_address: server.server_address }).catch(() => {});
      }

      connectionManager.disconnectFromServer(modalData.serverId);
      connectionManager.removeStoredServerSession(modalData.serverId);
      useServerStore.getState().removeServer(modalData.serverId);
      useUiStore.getState().setActiveServer(null);
      close();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to leave server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Leave Server">
      <div className="leave-server-content">
        <p>
          Are you sure you want to leave <strong>{modalData?.serverName}</strong>? You won't be able to
          rejoin unless you are re-invited.
        </p>

        {error && <div className="auth-error">{error}</div>}

        <div className="modal-actions">
          <button type="button" onClick={close} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleLeave} disabled={loading} className="btn-danger">
            {loading ? <LoadingSpinner size={18} /> : 'Leave Server'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
