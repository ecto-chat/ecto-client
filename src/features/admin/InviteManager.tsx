import { useState, useEffect, useCallback, type FormEvent } from 'react';

import { Link2, Copy, Check } from 'lucide-react';

import { Button, EmptyState, Input, ScrollArea, Select, Spinner } from '@/ui';

import { useUiStore } from '@/stores/ui';

import { connectionManager } from '@/services/connection-manager';

import type { Invite } from 'ecto-shared';

const EXPIRES_IN_OPTIONS = [
  { label: '30 minutes', value: '1800' },
  { label: '1 hour', value: '3600' },
  { label: '6 hours', value: '21600' },
  { label: '12 hours', value: '43200' },
  { label: '24 hours', value: '86400' },
  { label: '7 days', value: '604800' },
  { label: 'Never', value: '0' },
];

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return 'Never';
  const date = new Date(expiresAt);
  const now = new Date();
  if (date <= now) return 'Expired';
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (diffHours > 24) { const d = Math.floor(diffHours / 24); return `${d} day${d !== 1 ? 's' : ''} remaining`; }
  if (diffHours > 0) return `${diffHours}h ${diffMinutes}m remaining`;
  return `${diffMinutes}m remaining`;
}

export function InviteManager() {
  const serverId = useUiStore((s) => s.activeServerId);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresIn, setExpiresIn] = useState('86400');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    if (!serverId) return;
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    try {
      setLoading(true); setError('');
      setInvites(await trpc.invites.list.query());
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to load invites'); }
    finally { setLoading(false); }
  }, [serverId]);

  useEffect(() => { void fetchInvites(); }, [fetchInvites]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!serverId) return;
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    setCreating(true); setCreateError('');
    try {
      const params: { max_uses?: number | null; expires_in?: number | null } = {};
      if (maxUses.trim()) {
        const parsed = parseInt(maxUses, 10);
        if (isNaN(parsed) || parsed < 1) { setCreateError('Max uses must be a positive number'); setCreating(false); return; }
        params.max_uses = parsed;
      }
      const expVal = Number(expiresIn);
      params.expires_in = expVal > 0 ? expVal : null;
      await trpc.invites.create.mutate(params);
      setMaxUses(''); setExpiresIn('86400');
      await fetchInvites();
    } catch (err: unknown) { setCreateError(err instanceof Error ? err.message : 'Failed to create invite'); }
    finally { setCreating(false); }
  };

  const handleRevoke = async (inviteId: string) => {
    if (!serverId) return;
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    try { await trpc.invites.revoke.mutate({ invite_id: inviteId }); setInvites((prev) => prev.filter((inv) => inv.id !== inviteId)); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to revoke invite'); }
  };

  const handleCopy = async (code: string) => {
    const link = `${window.location.origin}/invite/${code}`;
    try { await navigator.clipboard.writeText(link); } catch { /* fallback omitted for brevity */ }
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (!serverId) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-primary">Invite Manager</h2>

      <form onSubmit={handleCreate} className="rounded-lg bg-secondary border-2 border-primary p-4 space-y-3">
        <h3 className="text-sm font-medium text-primary">Create Invite</h3>
        {createError && <p className="text-sm text-danger">{createError}</p>}
        <div className="flex gap-3 items-end">
          <Input label="Max Uses (optional)" type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="Unlimited" />
          <Select label="Expire After" options={EXPIRES_IN_OPTIONS} value={expiresIn} onValueChange={setExpiresIn} />
          <Button type="submit" loading={creating}>Create Invite</Button>
        </div>
      </form>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-primary">Active Invites</h3>
        {loading && <div className="flex justify-center py-6"><Spinner /></div>}
        {error && <p className="text-sm text-danger">{error}</p>}
        {!loading && invites.length === 0 && <EmptyState icon={<Link2 />} title="No active invites" description="Create one above." />}
        {!loading && invites.length > 0 && (
          <ScrollArea className="max-h-80">
            <div className="space-y-1">
              {invites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between rounded-md bg-secondary border-2 border-primary px-3 py-2">
                  <div>
                    <code className="text-sm text-primary">{invite.code}</code>
                    <div className="text-xs text-muted mt-0.5">
                      Uses: {invite.use_count}{invite.max_uses != null ? ` / ${invite.max_uses}` : ''} &middot; Expires: {formatExpiry(invite.expires_at)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => handleCopy(invite.code)}>
                      {copiedCode === invite.code ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy Link</>}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleRevoke(invite.id)}>Revoke</Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
