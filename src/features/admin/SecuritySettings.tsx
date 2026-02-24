import { useState, useEffect } from 'react';

import { Ban } from 'lucide-react';

import { Button, EmptyState, ScrollArea, Spinner } from '@/ui';

import { useServerStore } from '@/stores/server';

import { connectionManager } from '@/services/connection-manager';

import type { Ban as BanType } from 'ecto-shared';

type BansTabProps = {
  serverId: string;
};

export function BansTab({ serverId }: BansTabProps) {
  const [bans, setBans] = useState<BanType[]>([]);
  const [loading, setLoading] = useState(true);
  const eventSeq = useServerStore((s) => s.eventSeq.get(serverId) ?? 0);

  useEffect(() => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    trpc.bans.list.query()
      .then((result) => setBans(result))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [serverId, eventSeq]);

  const handleUnban = async (userId: string) => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    try {
      await trpc.members.unban.mutate({ user_id: userId });
      setBans((prev) => prev.filter((b) => b.user_id !== userId));
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
      <h3 className="text-base font-medium text-primary">
        Bans ({bans.length})
      </h3>

      {bans.length === 0 && (
        <EmptyState icon={<Ban />} title="No banned users" />
      )}

      <ScrollArea className="max-h-96">
        <div className="space-y-1">
          {bans.map((ban) => (
            <div
              key={ban.id}
              className="flex items-center justify-between rounded-md bg-secondary border-2 border-primary px-3 py-2"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="text-primary">{ban.username}</span>
                {ban.reason && (
                  <span className="text-muted">
                    &mdash; {ban.reason}
                  </span>
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleUnban(ban.user_id)}
              >
                Unban
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
