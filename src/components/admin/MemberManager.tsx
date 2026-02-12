import { useState, useEffect, useCallback } from 'react';
import { connectionManager } from '../../services/connection-manager.js';
import { useMemberStore } from '../../stores/member.js';
import { Avatar } from '../common/Avatar.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import { Modal } from '../common/Modal.js';
import type { Member, Role } from 'ecto-shared';

interface Props {
  serverId: string;
}

export function MemberManager({ serverId }: Props) {
  const membersMap = useMemberStore((s) => s.members.get(serverId));
  const members = membersMap ? [...membersMap.values()] : [];

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<{
    type: 'kick' | 'ban';
    member: Member;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Role assignment
  const [editingRoles, setEditingRoles] = useState<string | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [serverId]);

  const loadData = async () => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    try {
      const [membersResult, rolesResult] = await Promise.all([
        trpc.members.list.query({ limit: 100 }),
        trpc.roles.list.query(),
      ]);
      useMemberStore.getState().setMembers(serverId, membersResult.members);
      setRoles(rolesResult.sort((a, b) => b.position - a.position));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleKick = useCallback(async () => {
    if (!confirmAction || confirmAction.type !== 'kick') return;
    setActionLoading(true);
    try {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) throw new Error('Not connected');
      await trpc.members.kick.mutate({
        user_id: confirmAction.member.user_id,
        reason: reason || undefined,
      });
      useMemberStore.getState().removeMember(serverId, confirmAction.member.user_id);
      setConfirmAction(null);
      setReason('');
    } catch {
      // silent
    } finally {
      setActionLoading(false);
    }
  }, [confirmAction, reason, serverId]);

  const handleBan = useCallback(async () => {
    if (!confirmAction || confirmAction.type !== 'ban') return;
    setActionLoading(true);
    try {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) throw new Error('Not connected');
      await trpc.members.ban.mutate({
        user_id: confirmAction.member.user_id,
        reason: reason || undefined,
      });
      useMemberStore.getState().removeMember(serverId, confirmAction.member.user_id);
      setConfirmAction(null);
      setReason('');
    } catch {
      // silent
    } finally {
      setActionLoading(false);
    }
  }, [confirmAction, reason, serverId]);

  const startRoleEdit = (member: Member) => {
    setEditingRoles(member.user_id);
    setSelectedRoleIds([...member.roles]);
  };

  const handleSaveRoles = async (userId: string) => {
    try {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) throw new Error('Not connected');
      const updated = await trpc.members.updateRoles.mutate({
        user_id: userId,
        role_ids: selectedRoleIds,
      });
      useMemberStore.getState().updateMember(serverId, userId, updated);
      setEditingRoles(null);
    } catch {
      // silent
    }
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId],
    );
  };

  // Filter members by search
  const filtered = search
    ? members.filter((m) => {
        const term = search.toLowerCase();
        return (
          m.username.toLowerCase().includes(term) ||
          (m.display_name?.toLowerCase().includes(term) ?? false) ||
          (m.nickname?.toLowerCase().includes(term) ?? false)
        );
      })
    : members;

  // Non-default roles for assignment
  const assignableRoles = roles.filter((r) => !r.is_default);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner /></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: 'var(--text-primary, #fff)' }}>Members ({members.length})</h3>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members..."
          className="auth-input"
          style={{ width: 200 }}
        />
      </div>

      <div style={{ maxHeight: 400, overflow: 'auto' }}>
        {filtered.map((member) => {
          const isEditingRoles = editingRoles === member.user_id;
          const memberRoles = roles.filter((r) => member.roles.includes(r.id) && !r.is_default);

          return (
            <div
              key={member.user_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 12px',
                borderRadius: 4,
                backgroundColor: 'var(--bg-secondary, #2f3136)',
                marginBottom: 4,
              }}
            >
              <Avatar
                src={member.avatar_url}
                username={member.display_name ?? member.username}
                size={36}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-primary, #fff)', fontWeight: 500, fontSize: 14 }}>
                    {member.nickname ?? member.display_name ?? member.username}
                  </span>
                  {member.nickname && (
                    <span style={{ color: 'var(--text-muted, #72767d)', fontSize: 12 }}>
                      ({member.username})
                    </span>
                  )}
                  {/* Role badges */}
                  {memberRoles.map((role) => (
                    <span
                      key={role.id}
                      style={{
                        display: 'inline-block',
                        padding: '1px 6px',
                        borderRadius: 10,
                        fontSize: 11,
                        backgroundColor: role.color ? `${role.color}33` : 'var(--bg-tertiary, #202225)',
                        color: role.color ?? 'var(--text-secondary, #b9bbbe)',
                        border: `1px solid ${role.color ?? 'var(--border, #40444b)'}`,
                      }}
                    >
                      {role.name}
                    </span>
                  ))}
                </div>

                {/* Role editing */}
                {isEditingRoles && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                      {assignableRoles.map((role) => {
                        const checked = selectedRoleIds.includes(role.id);
                        return (
                          <label
                            key={role.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 8px',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontSize: 12,
                              backgroundColor: checked ? (role.color ? `${role.color}33` : 'var(--bg-modifier-selected, #42464d)') : 'var(--bg-tertiary, #202225)',
                              color: role.color ?? 'var(--text-primary, #fff)',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRole(role.id)}
                              style={{ accentColor: role.color ?? 'var(--accent, #5865f2)', width: 12, height: 12 }}
                            />
                            {role.name}
                          </label>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => setEditingRoles(null)}
                        style={{
                          padding: '2px 8px',
                          fontSize: 12,
                          border: 'none',
                          borderRadius: 4,
                          backgroundColor: 'var(--bg-tertiary, #202225)',
                          color: 'var(--text-primary, #fff)',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveRoles(member.user_id)}
                        className="auth-button"
                        style={{ fontSize: 12, padding: '2px 8px' }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {!isEditingRoles && (
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => startRoleEdit(member)}
                    style={{
                      padding: '4px 8px',
                      fontSize: 12,
                      border: 'none',
                      borderRadius: 4,
                      backgroundColor: 'transparent',
                      color: 'var(--text-secondary, #b9bbbe)',
                      cursor: 'pointer',
                    }}
                    title="Manage roles"
                  >
                    Roles
                  </button>
                  <button
                    onClick={() => { setConfirmAction({ type: 'kick', member }); setReason(''); }}
                    style={{
                      padding: '4px 8px',
                      fontSize: 12,
                      border: 'none',
                      borderRadius: 4,
                      backgroundColor: 'transparent',
                      color: '#faa81a',
                      cursor: 'pointer',
                    }}
                    title="Kick member"
                  >
                    Kick
                  </button>
                  <button
                    onClick={() => { setConfirmAction({ type: 'ban', member }); setReason(''); }}
                    style={{
                      padding: '4px 8px',
                      fontSize: 12,
                      border: 'none',
                      borderRadius: 4,
                      backgroundColor: 'transparent',
                      color: '#ed4245',
                      cursor: 'pointer',
                    }}
                    title="Ban member"
                  >
                    Ban
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation dialog */}
      <Modal
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.type === 'ban' ? 'Ban Member' : 'Kick Member'}
        width={400}
      >
        {confirmAction && (
          <div>
            <p style={{ color: 'var(--text-primary, #fff)', margin: '0 0 12px' }}>
              {confirmAction.type === 'ban'
                ? `Are you sure you want to ban ${confirmAction.member.display_name ?? confirmAction.member.username}? They will not be able to rejoin unless unbanned.`
                : `Are you sure you want to kick ${confirmAction.member.display_name ?? confirmAction.member.username}? They can rejoin with an invite.`}
            </p>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary, #b9bbbe)', display: 'block', marginBottom: 4 }}>
                Reason (optional)
              </span>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="auth-input"
                style={{ width: '100%' }}
                placeholder="Enter a reason..."
              />
            </label>
            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setConfirmAction(null)}
                style={{
                  padding: '8px 16px',
                  fontSize: 14,
                  border: 'none',
                  borderRadius: 4,
                  backgroundColor: 'var(--bg-tertiary, #202225)',
                  color: 'var(--text-primary, #fff)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmAction.type === 'ban' ? handleBan : handleKick}
                disabled={actionLoading}
                style={{
                  padding: '8px 16px',
                  fontSize: 14,
                  border: 'none',
                  borderRadius: 4,
                  backgroundColor: confirmAction.type === 'ban' ? '#ed4245' : '#faa81a',
                  color: '#fff',
                  cursor: 'pointer',
                  minWidth: 80,
                }}
              >
                {actionLoading ? (
                  <LoadingSpinner size={14} />
                ) : confirmAction.type === 'ban' ? (
                  'Ban'
                ) : (
                  'Kick'
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
