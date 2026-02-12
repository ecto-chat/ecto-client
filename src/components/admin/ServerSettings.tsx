import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useUiStore } from '../../stores/ui.js';
import { connectionManager } from '../../services/connection-manager.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import { Modal } from '../common/Modal.js';
import { RoleEditor } from './RoleEditor.js';
import { ChannelEditor } from './ChannelEditor.js';
import { MemberManager } from './MemberManager.js';
import type { Server, Ban, Invite, AuditLogEntry } from 'ecto-shared';

type Tab = 'overview' | 'roles' | 'channels' | 'members' | 'bans' | 'invites' | 'audit-log';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'roles', label: 'Roles' },
  { key: 'channels', label: 'Channels' },
  { key: 'members', label: 'Members' },
  { key: 'bans', label: 'Bans' },
  { key: 'invites', label: 'Invites' },
  { key: 'audit-log', label: 'Audit Log' },
];

export function ServerSettings() {
  const open = useUiStore((s) => s.activeModal === 'server-settings');
  const close = () => useUiStore.getState().closeModal();
  const serverId = useUiStore((s) => s.activeServerId);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  if (!open || !serverId) return null;

  return (
    <Modal open={open} onClose={close} title="Server Settings" width={800}>
      <div className="server-settings" style={{ display: 'flex', minHeight: 480, gap: 16 }}>
        <nav className="settings-tabs" style={{ minWidth: 160, borderRight: '1px solid var(--border, #40444b)', paddingRight: 16 }}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`settings-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                textAlign: 'left',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                marginBottom: 2,
                backgroundColor: activeTab === tab.key ? 'var(--bg-modifier-selected, #42464d)' : 'transparent',
                color: activeTab === tab.key ? 'var(--text-primary, #fff)' : 'var(--text-secondary, #b9bbbe)',
                fontSize: 14,
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="settings-content" style={{ flex: 1, overflow: 'auto' }}>
          {activeTab === 'overview' && <OverviewTab serverId={serverId} />}
          {activeTab === 'roles' && <RoleEditor serverId={serverId} />}
          {activeTab === 'channels' && <ChannelEditor serverId={serverId} />}
          {activeTab === 'members' && <MemberManager serverId={serverId} />}
          {activeTab === 'bans' && <BansTab serverId={serverId} />}
          {activeTab === 'invites' && <InvitesTab serverId={serverId} />}
          {activeTab === 'audit-log' && <AuditLogTab serverId={serverId} />}
        </div>
      </div>
    </Modal>
  );
}

// ---------- Overview Tab ----------

function OverviewTab({ serverId }: { serverId: string }) {
  const [server, setServer] = useState<Server | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    trpc.server.info.query().then((result) => {
      setServer(result.server);
      setName(result.server.name);
      setDescription(result.server.description ?? '');
    }).catch(() => {});
  }, [serverId]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) throw new Error('Not connected');
      const updated = await trpc.server.update.mutate({
        name: name || undefined,
        description: description || undefined,
      });
      setServer(updated);
      setSuccess('Server settings saved.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleIconUpload = async (file: File) => {
    setError('');
    try {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) throw new Error('Not connected');
      const result = await trpc.server.uploadIcon.mutate({ file });
      setServer((prev) => prev ? { ...prev, icon_url: result.icon_url } : prev);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload icon');
    }
  };

  if (!server) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner /></div>;
  }

  return (
    <form onSubmit={handleSave}>
      <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary, #fff)' }}>Server Overview</h3>

      {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
      {success && <div style={{ color: '#3ba55d', marginBottom: 12, fontSize: 14 }}>{success}</div>}

      <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              backgroundColor: 'var(--bg-tertiary, #2f3136)',
              backgroundImage: server.icon_url ? `url(${server.icon_url})` : undefined,
              backgroundSize: 'cover',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary, #b9bbbe)',
              fontSize: 28,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            {!server.icon_url && server.name.charAt(0).toUpperCase()}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleIconUpload(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{ marginTop: 8, fontSize: 12, background: 'none', border: 'none', color: 'var(--accent, #5865f2)', cursor: 'pointer' }}
          >
            Change Icon
          </button>
        </div>

        <div style={{ flex: 1 }}>
          <label className="auth-label" style={{ display: 'block', marginBottom: 12 }}>
            Server Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="auth-input"
              style={{ width: '100%', marginTop: 4 }}
              required
            />
          </label>

          <label className="auth-label" style={{ display: 'block' }}>
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="auth-input"
              style={{ width: '100%', marginTop: 4, minHeight: 80, resize: 'vertical' }}
              placeholder="Tell people about your server..."
            />
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" disabled={saving} className="auth-button" style={{ minWidth: 100 }}>
          {saving ? <LoadingSpinner size={18} /> : 'Save'}
        </button>
      </div>
    </form>
  );
}

// ---------- Bans Tab ----------

function BansTab({ serverId }: { serverId: string }) {
  const [bans, setBans] = useState<Ban[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    trpc.bans.list.query()
      .then((result) => setBans(result))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [serverId]);

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
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner /></div>;
  }

  return (
    <div>
      <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary, #fff)' }}>Bans ({bans.length})</h3>
      {bans.length === 0 && (
        <p style={{ color: 'var(--text-secondary, #b9bbbe)', fontSize: 14 }}>No banned users.</p>
      )}
      {bans.map((ban) => (
        <div
          key={ban.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: 4,
            backgroundColor: 'var(--bg-secondary, #2f3136)',
            marginBottom: 4,
          }}
        >
          <div>
            <span style={{ color: 'var(--text-primary, #fff)', fontWeight: 500 }}>{ban.username}</span>
            {ban.reason && (
              <span style={{ color: 'var(--text-secondary, #b9bbbe)', marginLeft: 8, fontSize: 13 }}>
                — {ban.reason}
              </span>
            )}
          </div>
          <button
            onClick={() => handleUnban(ban.user_id)}
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
            Unban
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------- Invites Tab ----------

function InvitesTab({ serverId }: { serverId: string }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    trpc.invites.list.query()
      .then((result) => setInvites(result))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [serverId]);

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
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner /></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: 'var(--text-primary, #fff)' }}>Invites ({invites.length})</h3>
        <button onClick={handleCreate} disabled={creating} className="auth-button" style={{ fontSize: 13, padding: '6px 16px' }}>
          {creating ? <LoadingSpinner size={14} /> : 'Create Invite'}
        </button>
      </div>
      {invites.length === 0 && (
        <p style={{ color: 'var(--text-secondary, #b9bbbe)', fontSize: 14 }}>No active invites.</p>
      )}
      {invites.map((invite) => (
        <div
          key={invite.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: 4,
            backgroundColor: 'var(--bg-secondary, #2f3136)',
            marginBottom: 4,
          }}
        >
          <div>
            <code style={{ color: 'var(--text-primary, #fff)', fontSize: 14 }}>{invite.code}</code>
            <span style={{ color: 'var(--text-secondary, #b9bbbe)', marginLeft: 12, fontSize: 13 }}>
              by {invite.creator_name} | {invite.use_count}{invite.max_uses ? `/${invite.max_uses}` : ''} uses
              {invite.expires_at && ` | expires ${new Date(invite.expires_at).toLocaleDateString()}`}
            </span>
          </div>
          <button
            onClick={() => handleRevoke(invite.id)}
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
            Revoke
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------- Audit Log Tab ----------

function AuditLogTab({ serverId }: { serverId: string }) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

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

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner /></div>;
  }

  return (
    <div>
      <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary, #fff)' }}>Audit Log</h3>
      {entries.length === 0 && (
        <p style={{ color: 'var(--text-secondary, #b9bbbe)', fontSize: 14 }}>No audit log entries.</p>
      )}
      {entries.map((entry) => (
        <div
          key={entry.id}
          style={{
            padding: '8px 12px',
            borderRadius: 4,
            backgroundColor: 'var(--bg-secondary, #2f3136)',
            marginBottom: 4,
            fontSize: 13,
          }}
        >
          <span style={{ color: 'var(--text-primary, #fff)', fontWeight: 500 }}>{entry.actor_name}</span>
          <span style={{ color: 'var(--text-secondary, #b9bbbe)' }}> {entry.action.replace(/_/g, ' ')}</span>
          {entry.target_id && (
            <span style={{ color: 'var(--text-secondary, #b9bbbe)' }}> target:{entry.target_type}</span>
          )}
          <span style={{ color: 'var(--text-muted, #72767d)', marginLeft: 8 }}>
            {new Date(entry.created_at).toLocaleString()}
          </span>
        </div>
      ))}
      {hasMore && (
        <button
          onClick={() => {
            const last = entries[entries.length - 1];
            if (last) loadEntries(last.id);
          }}
          style={{
            marginTop: 8,
            padding: '6px 16px',
            fontSize: 13,
            border: 'none',
            borderRadius: 4,
            backgroundColor: 'var(--bg-tertiary, #202225)',
            color: 'var(--text-primary, #fff)',
            cursor: 'pointer',
          }}
        >
          Load More
        </button>
      )}
    </div>
  );
}
