import { useState, useEffect } from 'react';

import { Users, Shield, LogOut, Ban } from 'lucide-react';

import { Avatar, Button, EmptyState, IconButton, Input, ScrollArea, Spinner, Tooltip } from '@/ui';

import { useMemberStore } from '@/stores/member';

import { connectionManager } from '@/services/connection-manager';

import type { Member, Role } from 'ecto-shared';

import { RoleAssignment, KickBanDialog } from './MemberActions';

type MemberManagerProps = {
  serverId: string;
};

export function MemberManager({ serverId }: MemberManagerProps) {
  const membersMap = useMemberStore((s) => s.members.get(serverId));
  const members = membersMap ? [...membersMap.values()] : [];

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingRoles, setEditingRoles] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'kick' | 'ban'; member: Member } | null>(null);

  useEffect(() => {
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
      } catch { /* silent */ } finally { setLoading(false); }
    };
    loadData();
  }, [serverId]);

  const filtered = search
    ? members.filter((m) => {
        const term = search.toLowerCase();
        return m.username.toLowerCase().includes(term)
          || (m.display_name?.toLowerCase().includes(term) ?? false)
          || (m.nickname?.toLowerCase().includes(term) ?? false);
      })
    : members;

  const assignableRoles = roles.filter((r) => !r.is_default);

  if (loading) return <div className="flex items-center justify-center py-10"><Spinner /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium text-primary">Members ({members.length})</h3>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members..."
          inputSize="sm"
          icon={<Users size={14} />}
          className="w-48"
        />
      </div>

      {filtered.length === 0 && (
        <EmptyState icon={<Users />} title="No members found" />
      )}

      <ScrollArea className="max-h-96">
        <div className="space-y-1">
          {filtered.map((member) => {
            const memberRoles = roles.filter((r) => member.roles.includes(r.id) && !r.is_default);
            const isEditingRoles = editingRoles === member.user_id;

            return (
              <div key={member.user_id} className="flex items-center gap-3 rounded-md bg-secondary border border-border px-3 py-2">
                <Avatar src={member.avatar_url} username={member.display_name ?? member.username} size={36} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm text-primary">
                      {member.nickname ?? member.display_name ?? member.username}
                    </span>
                    {member.nickname && (
                      <span className="text-xs text-muted">({member.username})</span>
                    )}
                    {memberRoles.map((role) => (
                      <span
                        key={role.id}
                        className="inline-flex items-center rounded-full border px-1.5 text-2xs"
                        style={{ borderColor: role.color ?? undefined, color: role.color ?? undefined }}
                      >
                        {role.name}
                      </span>
                    ))}
                  </div>

                  {isEditingRoles && (
                    <RoleAssignment
                      serverId={serverId}
                      member={member}
                      assignableRoles={assignableRoles}
                      onClose={() => setEditingRoles(null)}
                    />
                  )}
                </div>

                {!isEditingRoles && (
                  <div className="flex gap-1 shrink-0">
                    <Tooltip content="Manage roles">
                      <IconButton variant="ghost" size="sm" onClick={() => setEditingRoles(member.user_id)}>
                        <Shield size={14} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip content="Kick member">
                      <IconButton variant="ghost" size="sm" onClick={() => setConfirmAction({ type: 'kick', member })}>
                        <LogOut size={14} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip content="Ban member">
                      <IconButton variant="danger" size="sm" onClick={() => setConfirmAction({ type: 'ban', member })}>
                        <Ban size={14} />
                      </IconButton>
                    </Tooltip>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <KickBanDialog serverId={serverId} action={confirmAction} onClose={() => setConfirmAction(null)} />
    </div>
  );
}
