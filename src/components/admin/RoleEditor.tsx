import { useState, useEffect } from 'react';
import { Permissions } from 'ecto-shared';
import { connectionManager } from '../../services/connection-manager.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import type { Role } from 'ecto-shared';

type PermissionKey = keyof typeof Permissions;

/** Human-readable labels for each permission bit */
const PERMISSION_LABELS: { key: PermissionKey; label: string; category: string }[] = [
  // Server
  { key: 'ADMINISTRATOR', label: 'Administrator', category: 'Server' },
  { key: 'MANAGE_SERVER', label: 'Manage Server', category: 'Server' },
  { key: 'MANAGE_CHANNELS', label: 'Manage Channels', category: 'Server' },
  { key: 'MANAGE_ROLES', label: 'Manage Roles', category: 'Server' },
  { key: 'KICK_MEMBERS', label: 'Kick Members', category: 'Server' },
  { key: 'BAN_MEMBERS', label: 'Ban Members', category: 'Server' },
  { key: 'CREATE_INVITES', label: 'Create Invites', category: 'Server' },
  { key: 'VIEW_AUDIT_LOG', label: 'View Audit Log', category: 'Server' },
  { key: 'MANAGE_MESSAGES', label: 'Manage Messages', category: 'Server' },
  // Channel
  { key: 'READ_MESSAGES', label: 'Read Messages', category: 'Channel' },
  { key: 'SEND_MESSAGES', label: 'Send Messages', category: 'Channel' },
  { key: 'ATTACH_FILES', label: 'Attach Files', category: 'Channel' },
  { key: 'EMBED_LINKS', label: 'Embed Links', category: 'Channel' },
  { key: 'ADD_REACTIONS', label: 'Add Reactions', category: 'Channel' },
  // Voice
  { key: 'CONNECT_VOICE', label: 'Connect to Voice', category: 'Voice' },
  { key: 'SPEAK_VOICE', label: 'Speak in Voice', category: 'Voice' },
  { key: 'MUTE_MEMBERS', label: 'Mute Members', category: 'Voice' },
  { key: 'DEAFEN_MEMBERS', label: 'Deafen Members', category: 'Voice' },
  { key: 'USE_VOICE_ACTIVITY', label: 'Use Voice Activity', category: 'Voice' },
];

interface Props {
  serverId: string;
}

export function RoleEditor({ serverId }: Props) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Editable fields for the selected role
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#99aab5');
  const [editPerms, setEditPerms] = useState(0);

  useEffect(() => {
    loadRoles();
  }, [serverId]);

  const loadRoles = async () => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    try {
      const result = await trpc.roles.list.query();
      const sorted = result.sort((a, b) => b.position - a.position);
      setRoles(sorted);
      if (sorted.length > 0 && !selectedId) {
        selectRole(sorted[0]!);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const selectRole = (role: Role) => {
    setSelectedId(role.id);
    setEditName(role.name);
    setEditColor(role.color ?? '#99aab5');
    setEditPerms(role.permissions);
    setError('');
  };

  const selectedRole = roles.find((r) => r.id === selectedId) ?? null;

  const togglePermission = (permKey: PermissionKey) => {
    const bit = Permissions[permKey];
    setEditPerms((prev) => (prev & bit) ? (prev & ~bit) : (prev | bit));
  };

  const handleSave = async () => {
    if (!selectedId) return;
    setError('');
    setSaving(true);
    try {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) throw new Error('Not connected');
      const updated = await trpc.roles.update.mutate({
        role_id: selectedId,
        name: editName,
        color: editColor,
        permissions: editPerms,
      });
      setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    setError('');
    try {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) throw new Error('Not connected');
      const created = await trpc.roles.create.mutate({ name: 'New Role' });
      setRoles((prev) => [created, ...prev].sort((a, b) => b.position - a.position));
      selectRole(created);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create role');
    }
  };

  const handleDelete = async () => {
    if (!selectedId || !selectedRole) return;
    if (selectedRole.is_default) {
      setError('Cannot delete the default role.');
      return;
    }
    if (!window.confirm(`Delete role "${selectedRole.name}"? This cannot be undone.`)) return;
    setError('');
    try {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) throw new Error('Not connected');
      await trpc.roles.delete.mutate({ role_id: selectedId });
      const remaining = roles.filter((r) => r.id !== selectedId);
      setRoles(remaining);
      if (remaining.length > 0) {
        selectRole(remaining[0]!);
      } else {
        setSelectedId(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete role');
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner /></div>;
  }

  // Group permissions by category
  const categories = [...new Set(PERMISSION_LABELS.map((p) => p.category))];

  return (
    <div style={{ display: 'flex', gap: 16, minHeight: 400 }}>
      {/* Role List */}
      <div style={{ minWidth: 180, borderRight: '1px solid var(--border, #40444b)', paddingRight: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, color: 'var(--text-primary, #fff)' }}>Roles</h3>
          <button
            onClick={handleCreate}
            style={{
              padding: '2px 10px',
              fontSize: 18,
              fontWeight: 700,
              border: 'none',
              borderRadius: 4,
              backgroundColor: 'var(--accent, #5865f2)',
              color: '#fff',
              cursor: 'pointer',
              lineHeight: 1.2,
            }}
            title="Create Role"
          >
            +
          </button>
        </div>
        {roles.map((role) => (
          <button
            key={role.id}
            onClick={() => selectRole(role)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '6px 10px',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              marginBottom: 2,
              backgroundColor: selectedId === role.id ? 'var(--bg-modifier-selected, #42464d)' : 'transparent',
              color: 'var(--text-primary, #fff)',
              fontSize: 14,
              textAlign: 'left',
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: role.color ?? '#99aab5',
                flexShrink: 0,
              }}
            />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {role.name}
            </span>
          </button>
        ))}
      </div>

      {/* Permission Editor */}
      <div style={{ flex: 1 }}>
        {!selectedRole ? (
          <p style={{ color: 'var(--text-secondary, #b9bbbe)' }}>Select a role to edit.</p>
        ) : (
          <>
            {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-end' }}>
              <label style={{ flex: 1 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary, #b9bbbe)', display: 'block', marginBottom: 4 }}>
                  Role Name
                </span>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="auth-input"
                  style={{ width: '100%' }}
                  disabled={selectedRole.is_default}
                />
              </label>
              <label>
                <span style={{ fontSize: 12, color: 'var(--text-secondary, #b9bbbe)', display: 'block', marginBottom: 4 }}>
                  Color
                </span>
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  style={{ width: 40, height: 34, border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
                />
              </label>
            </div>

            <div style={{ maxHeight: 280, overflow: 'auto', marginBottom: 16 }}>
              {categories.map((cat) => (
                <div key={cat} style={{ marginBottom: 12 }}>
                  <h4 style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted, #72767d)', marginBottom: 6 }}>
                    {cat}
                  </h4>
                  {PERMISSION_LABELS
                    .filter((p) => p.category === cat)
                    .map((perm) => {
                      const bit = Permissions[perm.key];
                      const checked = (editPerms & bit) === bit;
                      return (
                        <label
                          key={perm.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '4px 0',
                            cursor: 'pointer',
                            color: 'var(--text-primary, #fff)',
                            fontSize: 14,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePermission(perm.key)}
                            style={{ accentColor: 'var(--accent, #5865f2)' }}
                          />
                          {perm.label}
                        </label>
                      );
                    })}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {!selectedRole.is_default && (
                <button
                  onClick={handleDelete}
                  style={{
                    padding: '6px 16px',
                    fontSize: 13,
                    border: 'none',
                    borderRadius: 4,
                    backgroundColor: '#ed4245',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Delete Role
                </button>
              )}
              <div style={{ marginLeft: 'auto' }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="auth-button"
                  style={{ minWidth: 80, fontSize: 13, padding: '6px 16px' }}
                >
                  {saving ? <LoadingSpinner size={14} /> : 'Save'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
