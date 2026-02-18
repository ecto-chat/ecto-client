import { useState, useCallback } from 'react';

import { Button, ConfirmDialog, Input } from '@/ui';

import { useMemberStore } from '@/stores/member';

import { connectionManager } from '@/services/connection-manager';

import type { Member, Role } from 'ecto-shared';

type MemberActionsProps = {
  serverId: string;
  member: Member;
  assignableRoles: Role[];
  onClose: () => void;
};

export function RoleAssignment({ serverId, member, assignableRoles, onClose }: MemberActionsProps) {
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([...member.roles]);

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId],
    );
  };

  const handleSave = async () => {
    try {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) throw new Error('Not connected');
      const updated = await trpc.members.updateRoles.mutate({
        user_id: member.user_id,
        role_ids: selectedRoleIds,
      });
      useMemberStore.getState().updateMember(serverId, member.user_id, updated);
      onClose();
    } catch {
      // silent
    }
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-1">
        {assignableRoles.map((role) => {
          const checked = selectedRoleIds.includes(role.id);
          return (
            <label
              key={role.id}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs cursor-pointer transition-colors duration-150"
              style={{
                backgroundColor: checked ? `${role.color ?? '#5865f2'}20` : undefined,
                color: role.color ?? undefined,
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleRole(role.id)}
                className="size-3 accent-accent"
              />
              {role.name}
            </label>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={handleSave}>Save</Button>
      </div>
    </div>
  );
}

type KickBanDialogProps = {
  serverId: string;
  action: { type: 'kick' | 'ban'; member: Member } | null;
  onClose: () => void;
};

export function KickBanDialog({ serverId, action, onClose }: KickBanDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (!action) return;
    setLoading(true);
    try {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) throw new Error('Not connected');
      if (action.type === 'kick') {
        await trpc.members.kick.mutate({ user_id: action.member.user_id, reason: reason || undefined });
      } else {
        await trpc.members.ban.mutate({ user_id: action.member.user_id, reason: reason || undefined });
      }
      useMemberStore.getState().removeMember(serverId, action.member.user_id);
      setReason('');
      onClose();
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [action, reason, serverId, onClose]);

  const memberName = action?.member.display_name ?? action?.member.username ?? '';
  const isBan = action?.type === 'ban';

  return (
    <ConfirmDialog
      open={action !== null}
      onOpenChange={(open) => { if (!open) { setReason(''); onClose(); } }}
      title={isBan ? 'Ban Member' : 'Kick Member'}
      description={
        isBan
          ? `Are you sure you want to ban ${memberName}? They will not be able to rejoin unless unbanned.`
          : `Are you sure you want to kick ${memberName}? They can rejoin with an invite.`
      }
      variant="danger"
      confirmLabel={isBan ? 'Ban' : 'Kick'}
      onConfirm={handleConfirm}
      loading={loading}
    />
  );
}
