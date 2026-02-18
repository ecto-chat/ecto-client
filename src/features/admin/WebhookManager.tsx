import { useState, useEffect, useCallback } from 'react';

import { Webhook, Copy, Check, RefreshCw, Trash2, Plus } from 'lucide-react';

import { Button, ConfirmDialog, EmptyState, Input, ScrollArea, Select, Spinner } from '@/ui';

import { useChannelStore } from '@/stores/channel';

import { connectionManager } from '@/services/connection-manager';

type WebhookData = { id: string; channel_id: string; name: string; avatar_url: string | null; token: string; created_by: string; created_at: string };
type ChannelOption = { id: string; name: string };

export function WebhookManager({ serverId }: { serverId: string }) {
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newChannelId, setNewChannelId] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const trpc = connectionManager.getServerTrpc(serverId);
  const baseUrl = connectionManager.getServerConnection(serverId)?.address ?? '';

  const loadWebhooks = useCallback(async () => {
    if (!trpc) return;
    try {
      const channelList: ChannelOption[] = [];
      const channelMap = useChannelStore.getState().channels.get(serverId);
      if (channelMap) {
        for (const ch of channelMap.values()) {
          if (ch.type === 'text') channelList.push({ id: ch.id, name: ch.name });
        }
      }
      setChannels(channelList);
      const allWebhooks: WebhookData[] = [];
      for (const ch of channelList) {
        try { allWebhooks.push(...await trpc.webhooks.list.query({ channel_id: ch.id })); } catch { /* skip */ }
      }
      setWebhooks(allWebhooks);
    } catch { setError('Failed to load webhooks'); } finally { setLoading(false); }
  }, [trpc, serverId]);

  useEffect(() => { loadWebhooks(); }, [loadWebhooks]);

  const handleCreate = async () => {
    if (!trpc || !newName.trim() || !newChannelId) return;
    setCreating(true); setError('');
    try {
      const webhook = await trpc.webhooks.create.mutate({ channel_id: newChannelId, name: newName.trim() });
      setWebhooks((prev) => [...prev, webhook]);
      setNewName(''); setNewChannelId(''); setShowCreate(false);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to create webhook'); }
    finally { setCreating(false); }
  };

  const handleDelete = async () => {
    if (!trpc || !deleteTarget) return;
    try { await trpc.webhooks.delete.mutate({ webhook_id: deleteTarget }); setWebhooks((prev) => prev.filter((w) => w.id !== deleteTarget)); }
    catch { /* silent */ } finally { setDeleteTarget(null); }
  };

  const handleRegenerate = async (webhookId: string) => {
    if (!trpc) return;
    try { const updated = await trpc.webhooks.regenerateToken.mutate({ webhook_id: webhookId }); setWebhooks((prev) => prev.map((w) => (w.id === webhookId ? updated : w))); }
    catch { /* silent */ }
  };

  const copyUrl = (webhook: WebhookData) => {
    navigator.clipboard.writeText(`${baseUrl}/webhooks/${webhook.id}/${webhook.token}`).then(() => {
      setCopiedId(webhook.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const getChannelName = (channelId: string) => channels.find((c) => c.id === channelId)?.name ?? 'unknown';

  if (loading) return <div className="flex items-center justify-center py-10"><Spinner /></div>;

  const channelOptions = channels.map((ch) => ({ value: ch.id, label: `#${ch.name}` }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium text-primary">Webhooks ({webhooks.length})</h3>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : <><Plus size={14} /> Create Webhook</>}
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}

      {showCreate && (
        <div className="rounded-lg bg-secondary border border-border p-4 space-y-3">
          <Input label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Webhook name" maxLength={80} />
          <Select label="Channel" options={[{ value: '', label: 'Select a channel...' }, ...channelOptions]} value={newChannelId} onValueChange={setNewChannelId} />
          <Button size="sm" loading={creating} disabled={!newName.trim() || !newChannelId} onClick={handleCreate}>Create</Button>
        </div>
      )}

      {webhooks.length === 0 && !showCreate && (
        <EmptyState icon={<Webhook />} title="No webhooks" description="Create one to allow external services to send messages." />
      )}

      <ScrollArea className="max-h-96">
        <div className="space-y-2">
          {webhooks.map((webhook) => (
            <div key={webhook.id} className="rounded-lg bg-secondary border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-primary">{webhook.name}</span>
                  <span className="text-xs text-muted ml-2">#{getChannelName(webhook.channel_id)}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => copyUrl(webhook)}>
                    {copiedId === webhook.id ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy URL</>}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleRegenerate(webhook.id)}>
                    <RefreshCw size={14} /> Regenerate
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setDeleteTarget(webhook.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted">Created {new Date(webhook.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </ScrollArea>

      <ConfirmDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }} title="Delete Webhook" description="Delete this webhook? This cannot be undone." variant="danger" confirmLabel="Delete" onConfirm={handleDelete} />
    </div>
  );
}
