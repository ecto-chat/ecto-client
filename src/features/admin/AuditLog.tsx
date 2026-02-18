import { useState, useEffect, useCallback } from 'react';

import { FileText } from 'lucide-react';

import { Button, EmptyState, ScrollArea, Select, Spinner } from '@/ui';

import { useUiStore } from '@/stores/ui';

import { connectionManager } from '@/services/connection-manager';

import type { AuditLogEntry, AuditLogAction } from 'ecto-shared';

const ACTION_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Actions' },
  { value: 'server.update', label: 'Server Update' },
  { value: 'channel.create', label: 'Channel Create' },
  { value: 'channel.update', label: 'Channel Update' },
  { value: 'channel.delete', label: 'Channel Delete' },
  { value: 'category.create', label: 'Category Create' },
  { value: 'category.update', label: 'Category Update' },
  { value: 'category.delete', label: 'Category Delete' },
  { value: 'role.create', label: 'Role Create' },
  { value: 'role.update', label: 'Role Update' },
  { value: 'role.delete', label: 'Role Delete' },
  { value: 'member.kick', label: 'Member Kick' },
  { value: 'member.ban', label: 'Member Ban' },
  { value: 'member.unban', label: 'Member Unban' },
  { value: 'member.roles_update', label: 'Member Roles Update' },
  { value: 'member.nickname_update', label: 'Member Nickname Update' },
  { value: 'invite.create', label: 'Invite Create' },
  { value: 'invite.revoke', label: 'Invite Revoke' },
  { value: 'message.delete', label: 'Message Delete' },
  { value: 'message.pin', label: 'Message Pin' },
  { value: 'permission.update', label: 'Permission Update' },
];

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatActionLabel(action: string): string {
  return action.split('.').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details) return '';
  return Object.entries(details).map(([k, v]) => `${k}: ${String(v)}`).join(', ');
}

export function AuditLog() {
  const serverId = useUiStore((s) => s.activeServerId);
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [filterAction, setFilterAction] = useState('');

  const fetchEntries = useCallback(async (before?: string) => {
    if (!serverId) return;
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    try {
      if (before) setLoadingMore(true); else setLoading(true);
      setError('');
      const params: { limit: number; before?: string; action?: string } = { limit: 50 };
      if (before) params.before = before;
      if (filterAction) params.action = filterAction;
      const result = await trpc.auditlog.list.query(params);
      setEntries((prev) => before ? [...prev, ...result.entries] : result.entries);
      setHasMore(result.has_more);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to load audit log'); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [serverId, filterAction]);

  useEffect(() => { setEntries([]); setHasMore(true); void fetchEntries(); }, [fetchEntries]);

  const handleLoadMore = () => {
    if (entries.length === 0 || loadingMore) return;
    const last = entries[entries.length - 1];
    if (last) void fetchEntries(last.id);
  };

  if (!serverId) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-primary">Audit Log</h2>
        <Select options={ACTION_FILTER_OPTIONS} value={filterAction} onValueChange={(v) => setFilterAction(v)} placeholder="Filter by action" />
      </div>

      {loading && <div className="flex justify-center py-8"><Spinner /></div>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {!loading && entries.length === 0 && (
        <EmptyState icon={<FileText />} title={filterAction ? 'No entries match the filter' : 'No audit log entries'} />
      )}

      {!loading && entries.length > 0 && (
        <ScrollArea className="max-h-[28rem]">
          <div className="space-y-1">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-md bg-secondary border border-border px-3 py-2 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-accent">{formatActionLabel(entry.action)}</span>
                  <span className="text-xs text-muted">{formatTimestamp(entry.created_at)}</span>
                </div>
                <div className="text-sm">
                  <span className="text-primary">{entry.actor_name}</span>
                  {entry.target_id && <span className="text-secondary"> &rarr; {entry.target_type}: {entry.target_id}</span>}
                </div>
                {entry.details && Object.keys(entry.details).length > 0 && (
                  <p className="text-xs text-muted">{formatDetails(entry.details)}</p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {!loading && hasMore && (
        <Button variant="secondary" size="sm" onClick={handleLoadMore} loading={loadingMore}>
          Load More
        </Button>
      )}
    </div>
  );
}
