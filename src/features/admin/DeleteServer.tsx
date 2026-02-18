import { useState, type FormEvent } from 'react';

import { Button, Input } from '@/ui';

import { useServerStore } from '@/stores/server';
import { useUiStore } from '@/stores/ui';

import { connectionManager } from '@/services/connection-manager';

type DeleteServerProps = {
  serverId: string;
  onError: (msg: string) => void;
};

export function DeleteServer({ serverId, onError }: DeleteServerProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const serverName = useServerStore((s) => s.servers.get(serverId))?.server_name ?? '';

  const handleDelete = async (e: FormEvent) => {
    e.preventDefault();
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    setLoading(true);
    try {
      await trpc.server.delete.mutate({ confirmation });
      connectionManager.disconnectFromServer(serverId);
      useServerStore.getState().removeServer(serverId);
      useUiStore.getState().closeModal();
      useUiStore.getState().setActiveServer(null);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Failed to delete server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-danger/40 bg-danger/5 p-4 space-y-3">
      <p className="text-sm font-medium text-primary">Delete This Server</p>
      <p className="text-sm text-secondary">
        This action is permanent and irreversible. All channels, messages, roles, and member data
        will be permanently deleted.
      </p>

      {!confirmOpen ? (
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>
          Delete Server
        </Button>
      ) : (
        <form onSubmit={handleDelete} className="space-y-3">
          <Input
            label={`Type "${serverName}" to confirm`}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoFocus
            placeholder="Server name"
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => { setConfirmOpen(false); setConfirmation(''); }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              type="submit"
              loading={loading}
              disabled={confirmation !== serverName}
            >
              Permanently Delete Server
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
