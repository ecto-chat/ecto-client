import { useState, useEffect, useCallback } from 'react';
import { connectionManager } from '../../services/connection-manager.js';
import { useUiStore } from '../../stores/ui.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import type { AuditLogEntry, AuditLogAction } from 'ecto-shared';

const ACTION_FILTER_OPTIONS: { value: '' | AuditLogAction; label: string }[] = [
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
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatActionLabel(action: string): string {
  return action
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details) return '';
  const entries = Object.entries(details);
  if (entries.length === 0) return '';
  return entries
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');
}

export function AuditLog() {
  const serverId = useUiStore((s) => s.activeServerId);

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [filterAction, setFilterAction] = useState<'' | AuditLogAction>('');

  const fetchEntries = useCallback(
    async (before?: string) => {
      if (!serverId) return;
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) return;

      try {
        if (before) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }
        setError('');

        const params: { limit: number; before?: string; action?: string } = { limit: 50 };
        if (before) {
          params.before = before;
        }
        if (filterAction) {
          params.action = filterAction;
        }

        const result = await trpc.auditlog.list.query(params);

        if (before) {
          setEntries((prev) => [...prev, ...result.entries]);
        } else {
          setEntries(result.entries);
        }

        setHasMore(result.has_more);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load audit log');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [serverId, filterAction],
  );

  useEffect(() => {
    setEntries([]);
    setHasMore(true);
    void fetchEntries();
  }, [fetchEntries]);

  const handleLoadMore = () => {
    if (entries.length === 0 || loadingMore) return;
    const lastEntry = entries[entries.length - 1];
    if (lastEntry) {
      void fetchEntries(lastEntry.id);
    }
  };

  if (!serverId) {
    return <div className="audit-log">No server selected.</div>;
  }

  return (
    <div className="audit-log">
      <div className="audit-log-header">
        <h2>Audit Log</h2>
        <div className="audit-log-filters">
          <label className="auth-label">
            Filter by Action
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value as '' | AuditLogAction)}
              className="auth-input"
            >
              {ACTION_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading && (
        <div className="audit-log-loading">
          <LoadingSpinner size={24} />
        </div>
      )}

      {error && <div className="auth-error">{error}</div>}

      {!loading && entries.length === 0 && (
        <div className="audit-log-empty">
          {filterAction
            ? 'No audit log entries match the selected filter.'
            : 'No audit log entries found.'}
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div className="audit-log-list">
          {entries.map((entry) => (
            <div key={entry.id} className="audit-log-entry">
              <div className="audit-log-entry-header">
                <span className="audit-log-action">
                  {formatActionLabel(entry.action)}
                </span>
                <span className="audit-log-timestamp">
                  {formatTimestamp(entry.created_at)}
                </span>
              </div>
              <div className="audit-log-entry-body">
                <span className="audit-log-actor">{entry.actor_name}</span>
                {entry.target_id && (
                  <span className="audit-log-target">
                    {' '}
                    &rarr; {entry.target_type}: {entry.target_id}
                  </span>
                )}
              </div>
              {entry.details && Object.keys(entry.details).length > 0 && (
                <div className="audit-log-entry-details">
                  {formatDetails(entry.details)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && hasMore && (
        <div className="audit-log-load-more">
          <button
            className="btn-secondary"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? <LoadingSpinner size={18} /> : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}
