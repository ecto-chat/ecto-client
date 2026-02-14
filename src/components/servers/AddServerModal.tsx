import { useState, type FormEvent } from 'react';
import { Modal } from '../common/Modal.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import { useUiStore } from '../../stores/ui.js';
import { useAuthStore } from '../../stores/auth.js';
import { useServerStore } from '../../stores/server.js';
import { connectionManager } from '../../services/connection-manager.js';

export function AddServerModal() {
  const open = useUiStore((s) => s.activeModal === 'add-server');
  const close = () => useUiStore.getState().closeModal();

  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const isCentral = useAuthStore.getState().centralAuthState === 'authenticated';
      const token = useAuthStore.getState().getToken();

      let realServerId: string;

      if (isCentral && token) {
        // Path A: Central-authenticated flow — use server.join with Central JWT
        realServerId = await connectionManager.connectToServer(address, address, token);

        // Add to central server list (ignore duplicate)
        const centralTrpc = connectionManager.getCentralTrpc();
        if (centralTrpc) {
          await centralTrpc.servers.add.mutate({
            server_address: address,
          }).catch(() => {});
        }
      } else {
        // Path B: Local-only mode — fetch server info and connect with local token
        const serverUrl = address.startsWith('http') ? address : `http://${address}`;

        // We need to do server.join with local auth — redirect to direct-connect form
        // For now, just try server.info to verify the server exists
        const infoRes = await fetch(`${serverUrl}/trpc/server.info`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!infoRes.ok) throw new Error('Could not reach server');

        // In local-only mode, we need the user to authenticate locally.
        // Close this modal and redirect to direct connect
        close();
        setAddress('');
        useUiStore.getState().openModal('direct-connect-from-app', { address });
        return;
      }

      // Update local store with the real server ID
      const conn = connectionManager.getServerTrpc(realServerId);
      let serverName = address;
      try {
        if (conn) {
          const info = await conn.server.info.query();
          serverName = info.server.name ?? address;
        }
      } catch { /* use address as fallback name */ }

      useServerStore.getState().addServer({
        id: realServerId,
        server_address: address,
        server_name: serverName,
        server_icon: null,
        position: useServerStore.getState().serverOrder.length,
        joined_at: new Date().toISOString(),
      });

      // Switch UI to the new server
      useUiStore.getState().setActiveServer(realServerId);

      setAddress('');
      close();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to join server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Add a Server">
      <form onSubmit={handleSubmit} className="add-server-form">
        {error && <div className="auth-error">{error}</div>}

        <label className="auth-label">
          Server Address
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="example.com:3000"
            required
            autoFocus
            className="auth-input"
          />
        </label>

        <p className="add-server-hint">
          Enter the address of the server you want to join, or paste an invite link.
        </p>

        <div className="modal-actions">
          <button type="button" onClick={close} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="auth-button">
            {loading ? <LoadingSpinner size={18} /> : 'Join Server'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
