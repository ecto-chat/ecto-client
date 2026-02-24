import { useState, useEffect } from 'react';

import { Link2, Plus } from 'lucide-react';

import { Button, EmptyState, ScrollArea, Spinner } from '@/ui';

import { useServerStore } from '@/stores/server';

import { connectionManager } from '@/services/connection-manager';

import type { Invite } from 'ecto-shared';

type InvitesTabProps = {
  serverId: string;
};

export function InvitesTab({ serverId }: InvitesTabProps) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const eventSeq = useServerStore((s) => s.eventSeq.get(serverId) ?? 0);

  useEffect(() => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    trpc.invites.list.query()
      .then((result) => setInvites(result))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [serverId, eventSeq]);

  const handleCreate = async () => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    setCreating(true);
    try {
      const result = await trpc.invites.create.mutate({});
      setInvites((prev) => [result.invite, ...prev]);
    } catch {
      // silent
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    try {
      await trpc.invites.revoke.mutate({ invite_id: inviteId });
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch {
      // silent
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium text-primary">
          Invites ({invites.length})
        </h3>
        <Button size="sm" loading={creating} onClick={handleCreate}>
          <Plus size={14} /> Create Invite
        </Button>
      </div>

      {invites.length === 0 && (
        <EmptyState icon={<Link2 />} title="No active invites" />
      )}

      <ScrollArea className="max-h-96">
        <div className="space-y-1">
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center justify-between rounded-md bg-secondary border-2 border-primary px-3 py-2"
            >
              <div className="flex items-center gap-3 text-sm">
                <code className="text-primary">{invite.code}</code>
                <span className="text-muted text-xs">
                  by {invite.creator_name} | {invite.use_count}
                  {invite.max_uses ? `/${invite.max_uses}` : ''} uses
                  {invite.expires_at && ` | expires ${new Date(invite.expires_at).toLocaleDateString()}`}
                </span>
              </div>
              <Button variant="danger" size="sm" onClick={() => handleRevoke(invite.id)}>
                Revoke
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
