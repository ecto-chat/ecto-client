import { useState, useEffect, useMemo } from 'react';

import { FileText, Search } from 'lucide-react';

import { Button, EmptyState, Input, ScrollArea, Spinner } from '@/ui';

import { connectionManager } from '@/services/connection-manager';

import type { AuditLogEntry } from 'ecto-shared';

type AuditLogTabProps = {
  serverId: string;
};

export function AuditLogTab({ serverId }: AuditLogTabProps) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState('');

  const loadEntries = async (before?: string) => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    try {
      const result = await trpc.auditlog.list.query({ before, limit: 50 });
      if (before) {
        setEntries((prev) => [...prev, ...result.entries]);
      } else {
        setEntries(result.entries);
      }
      setHasMore(result.has_more);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, [serverId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter((e) =>
      e.actor_name?.toLowerCase().includes(q) ||
      e.action.toLowerCase().includes(q) ||
      e.target_type?.toLowerCase().includes(q) ||
      e.target_id?.toLowerCase().includes(q),
    );
  }, [entries, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-base font-medium text-primary">Audit Log</h3>
        <Input
          placeholder="Search logs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search size={14} />}
          className="max-w-56"
        />
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={<FileText />} title="No audit log entries" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Search />} title="No matching entries" />
      ) : (
        <ScrollArea className="max-h-[24rem]">
          <div className="space-y-1">
            {filtered.map((entry) => (
              <div
                key={entry.id}
                className="rounded-md bg-secondary border border-border px-3 py-2 text-sm"
              >
                <span className="text-primary">{entry.actor_name}</span>
                <span className="text-secondary"> {entry.action.replace(/[._]/g, ' ')}</span>
                {entry.target_id && (
                  <span className="text-secondary"> target:{entry.target_type}</span>
                )}
                <span className="ml-2 text-xs text-muted">
                  {new Date(entry.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {hasMore && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            const last = entries[entries.length - 1];
            if (last) loadEntries(last.id);
          }}
        >
          Load More
        </Button>
      )}
    </div>
  );
}
