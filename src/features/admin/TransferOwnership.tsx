import { useState, useEffect, type FormEvent } from 'react';

import { Button, Input, SearchSelect } from '@/ui';

import { useServerStore } from '@/stores/server';

import { connectionManager } from '@/services/connection-manager';

type TransferOwnershipProps = {
  serverId: string;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
};

export function TransferOwnership({ serverId, onError, onSuccess }: TransferOwnershipProps) {
  const [target, setTarget] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<{ user_id: string; username: string; display_name: string | null }[]>([]);

  const serverName = useServerStore((s) => s.servers.get(serverId))?.server_name ?? '';
  const myUserId = useServerStore((s) => s.serverMeta.get(serverId))?.user_id;

  useEffect(() => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    trpc.members.list.query({ limit: 100 }).then((result) => {
      setMembers(
        result.members
          .filter((m) => m.user_id !== myUserId)
          .map((m) => ({ user_id: m.user_id, username: m.username, display_name: m.display_name ?? null })),
      );
    }).catch((err: unknown) => {
      console.warn('[admin] Failed to load members:', err);
    });
  }, [serverId, myUserId]);

  const handleTransfer = async (e: FormEvent) => {
    e.preventDefault();
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc || !target) return;
    setLoading(true);
    try {
      await trpc.server.transferOwnership.mutate({ new_owner_id: target, confirmation });
      onSuccess('Ownership transferred successfully.');
      setConfirmOpen(false);
      setConfirmation('');
      setTarget('');
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Failed to transfer ownership');
    } finally {
      setLoading(false);
    }
  };

  const memberOptions = members.map((m) => ({
    value: m.user_id,
    label: m.display_name ? `${m.display_name} (${m.username})` : m.username,
  }));

  return (
    <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 space-y-3">
      <p className="text-sm font-medium text-primary">Transfer Ownership</p>
      <p className="text-sm text-secondary">
        Transfer server ownership to another member. You will remain a member but lose owner privileges.
      </p>

      {members.length === 0 ? (
        <p className="text-xs text-muted">No other members found to transfer ownership to.</p>
      ) : !confirmOpen ? (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <SearchSelect
              options={memberOptions}
              value={target}
              onValueChange={setTarget}
              placeholder="Select a member..."
              searchPlaceholder="Search members..."
            />
          </div>
          <Button variant="secondary" disabled={!target} onClick={() => setConfirmOpen(true)}>
            Transfer
          </Button>
        </div>
      ) : (
        <form onSubmit={handleTransfer} className="space-y-3">
          <Input
            label={`Type "${serverName}" to confirm`}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoFocus
            placeholder="Server name"
          />
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={() => { setConfirmOpen(false); setConfirmation(''); }}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={confirmation !== serverName}>
              Confirm Transfer
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
