import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { connectionManager } from '../../services/connection-manager.js';
import { useUiStore } from '../../stores/ui.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import type { Invite } from 'ecto-shared';

const EXPIRES_IN_OPTIONS = [
  { label: '30 minutes', value: 1800 },
  { label: '1 hour', value: 3600 },
  { label: '6 hours', value: 21600 },
  { label: '12 hours', value: 43200 },
  { label: '24 hours', value: 86400 },
  { label: '7 days', value: 604800 },
  { label: 'Never', value: 0 },
] as const;

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return 'Never';
  const date = new Date(expiresAt);
  const now = new Date();
  if (date <= now) return 'Expired';

  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffHours > 24) {
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} remaining`;
  }
  if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes}m remaining`;
  }
  return `${diffMinutes}m remaining`;
}

export function InviteManager() {
  const serverId = useUiStore((s) => s.activeServerId);

  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create form state
  const [maxUses, setMaxUses] = useState('');
  const [expiresIn, setExpiresIn] = useState<number>(86400);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    if (!serverId) return;
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;

    try {
      setLoading(true);
      setError('');
      const result = await trpc.invites.list.query();
      setInvites(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load invites');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    void fetchInvites();
  }, [fetchInvites]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!serverId) return;
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;

    setCreating(true);
    setCreateError('');

    try {
      const params: { max_uses?: number | null; expires_in?: number | null } = {};
      if (maxUses.trim()) {
        const parsed = parseInt(maxUses, 10);
        if (isNaN(parsed) || parsed < 1) {
          setCreateError('Max uses must be a positive number');
          setCreating(false);
          return;
        }
        params.max_uses = parsed;
      }
      if (expiresIn > 0) {
        params.expires_in = expiresIn;
      } else {
        params.expires_in = null;
      }

      await trpc.invites.create.mutate(params);
      setMaxUses('');
      setExpiresIn(86400);
      await fetchInvites();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    if (!serverId) return;
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;

    try {
      await trpc.invites.revoke.mutate({ invite_id: inviteId });
      setInvites((prev) => prev.filter((inv) => inv.id !== inviteId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to revoke invite');
    }
  };

  const handleCopy = async (code: string) => {
    const link = `${window.location.origin}/invite/${code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // Fallback: select text in a temporary input
      const input = document.createElement('input');
      input.value = link;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  if (!serverId) {
    return <div className="invite-manager">No server selected.</div>;
  }

  return (
    <div className="invite-manager">
      <h2>Invite Manager</h2>

      {/* Create invite form */}
      <form onSubmit={handleCreate} className="invite-create-form">
        <h3>Create Invite</h3>
        {createError && <div className="auth-error">{createError}</div>}

        <div className="invite-create-fields">
          <label className="auth-label">
            Max Uses (optional)
            <input
              type="number"
              min="1"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Unlimited"
              className="auth-input"
            />
          </label>

          <label className="auth-label">
            Expire After
            <select
              value={expiresIn}
              onChange={(e) => setExpiresIn(Number(e.target.value))}
              className="auth-input"
            >
              {EXPIRES_IN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" disabled={creating} className="auth-button">
            {creating ? <LoadingSpinner size={18} /> : 'Create Invite'}
          </button>
        </div>
      </form>

      {/* Active invites list */}
      <div className="invite-list-section">
        <h3>Active Invites</h3>

        {loading && (
          <div className="invite-loading">
            <LoadingSpinner size={24} />
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}

        {!loading && invites.length === 0 && (
          <div className="invite-empty">No active invites. Create one above.</div>
        )}

        {!loading && invites.length > 0 && (
          <div className="invite-list">
            {invites.map((invite) => (
              <div key={invite.id} className="invite-row">
                <div className="invite-info">
                  <span className="invite-code">{invite.code}</span>
                  <div className="invite-details">
                    <span>
                      Uses: {invite.use_count}
                      {invite.max_uses != null ? ` / ${invite.max_uses}` : ''}
                    </span>
                    <span>Expires: {formatExpiry(invite.expires_at)}</span>
                  </div>
                </div>
                <div className="invite-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => handleCopy(invite.code)}
                  >
                    {copiedCode === invite.code ? 'Copied!' : 'Copy Link'}
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => handleRevoke(invite.id)}
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
