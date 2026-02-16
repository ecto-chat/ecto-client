import { useState, useEffect, useCallback } from 'react';
import { connectionManager } from '../../services/connection-manager.js';
import { useChannelStore } from '../../stores/channel.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';

interface Webhook {
  id: string;
  channel_id: string;
  name: string;
  avatar_url: string | null;
  token: string;
  created_by: string;
  created_at: string;
}

interface Channel {
  id: string;
  name: string;
  type: string;
}

export function WebhookManager({ serverId }: { serverId: string }) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newChannelId, setNewChannelId] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const trpc = connectionManager.getServerTrpc(serverId);
  const serverConn = connectionManager.getServerConnection(serverId);
  const baseUrl = serverConn?.address ?? '';

  const loadWebhooks = useCallback(async () => {
    if (!trpc) return;
    try {
      // Load text channels from channel store
      const channelList: Channel[] = [];
      const channelMap = useChannelStore.getState().channels.get(serverId);
      if (channelMap) {
        for (const ch of channelMap.values()) {
          if (ch.type === 'text') channelList.push({ id: ch.id, name: ch.name, type: ch.type });
        }
      }
      setChannels(channelList);

      // Load webhooks from all text channels
      const allWebhooks: Webhook[] = [];
      for (const ch of channelList) {
        try {
          const list = await trpc.webhooks.list.query({ channel_id: ch.id });
          allWebhooks.push(...list);
        } catch {
          // Channel might not have webhooks permission, skip
        }
      }
      setWebhooks(allWebhooks);
    } catch {
      setError('Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }, [trpc, serverId]);

  useEffect(() => {
    loadWebhooks();
  }, [loadWebhooks]);

  const handleCreate = async () => {
    if (!trpc || !newName.trim() || !newChannelId) return;
    setCreating(true);
    setError('');
    try {
      const webhook = await trpc.webhooks.create.mutate({
        channel_id: newChannelId,
        name: newName.trim(),
      });
      setWebhooks((prev) => [...prev, webhook]);
      setNewName('');
      setNewChannelId('');
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create webhook');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (webhookId: string) => {
    if (!trpc) return;
    try {
      await trpc.webhooks.delete.mutate({ webhook_id: webhookId });
      setWebhooks((prev) => prev.filter((w) => w.id !== webhookId));
    } catch {
      // silent
    }
  };

  const handleRegenerate = async (webhookId: string) => {
    if (!trpc) return;
    try {
      const updated = await trpc.webhooks.regenerateToken.mutate({ webhook_id: webhookId });
      setWebhooks((prev) => prev.map((w) => (w.id === webhookId ? updated : w)));
    } catch {
      // silent
    }
  };

  const copyUrl = (webhook: Webhook) => {
    const url = `${baseUrl}/webhooks/${webhook.id}/${webhook.token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(webhook.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const getChannelName = (channelId: string) => {
    return channels.find((c) => c.id === channelId)?.name ?? 'unknown';
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner /></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: 'var(--text-primary, #fff)' }}>Webhooks ({webhooks.length})</h3>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="auth-button"
          style={{ fontSize: 13, padding: '6px 16px' }}
        >
          {showCreate ? 'Cancel' : 'Create Webhook'}
        </button>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}

      {showCreate && (
        <div style={{
          padding: 16,
          borderRadius: 8,
          backgroundColor: 'var(--bg-secondary, #2f3136)',
          marginBottom: 16,
        }}>
          <label className="auth-label" style={{ display: 'block', marginBottom: 12 }}>
            Name
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="auth-input"
              style={{ width: '100%', marginTop: 4 }}
              placeholder="Webhook name"
              maxLength={80}
            />
          </label>
          <label className="auth-label" style={{ display: 'block', marginBottom: 12 }}>
            Channel
            <select
              value={newChannelId}
              onChange={(e) => setNewChannelId(e.target.value)}
              className="auth-input"
              style={{ width: '100%', marginTop: 4 }}
            >
              <option value="">Select a channel...</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>#{ch.name}</option>
              ))}
            </select>
          </label>
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim() || !newChannelId}
            className="auth-button"
            style={{ fontSize: 13, padding: '6px 16px' }}
          >
            {creating ? <LoadingSpinner size={14} /> : 'Create'}
          </button>
        </div>
      )}

      {webhooks.length === 0 && !showCreate && (
        <p style={{ color: 'var(--text-secondary, #b9bbbe)', fontSize: 14 }}>
          No webhooks configured. Create one to allow external services to send messages to your channels.
        </p>
      )}

      {webhooks.map((webhook) => (
        <div
          key={webhook.id}
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            backgroundColor: 'var(--bg-secondary, #2f3136)',
            marginBottom: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <span style={{ color: 'var(--text-primary, #fff)', fontWeight: 600, fontSize: 15 }}>
                {webhook.name}
              </span>
              <span style={{ color: 'var(--text-secondary, #b9bbbe)', marginLeft: 8, fontSize: 13 }}>
                #{getChannelName(webhook.channel_id)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => copyUrl(webhook)}
                style={{
                  padding: '4px 12px',
                  fontSize: 13,
                  border: 'none',
                  borderRadius: 4,
                  backgroundColor: 'var(--accent, #5865f2)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                {copiedId === webhook.id ? 'Copied!' : 'Copy URL'}
              </button>
              <button
                onClick={() => handleRegenerate(webhook.id)}
                style={{
                  padding: '4px 12px',
                  fontSize: 13,
                  border: 'none',
                  borderRadius: 4,
                  backgroundColor: 'var(--bg-tertiary, #202225)',
                  color: 'var(--text-primary, #fff)',
                  cursor: 'pointer',
                }}
              >
                Regenerate Token
              </button>
              <button
                onClick={() => handleDelete(webhook.id)}
                style={{
                  padding: '4px 12px',
                  fontSize: 13,
                  border: 'none',
                  borderRadius: 4,
                  backgroundColor: '#ed4245',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #72767d)' }}>
            Created {new Date(webhook.created_at).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
}
