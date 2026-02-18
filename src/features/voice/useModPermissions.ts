import { Permissions } from 'ecto-shared';

import { useServerStore } from '@/stores/server';
import { useMemberStore } from '@/stores/member';
import { useRoleStore } from '@/stores/role';

export function useModPermissions(serverId: string | null) {
  const meta = useServerStore((s) => (serverId ? s.serverMeta.get(serverId) : undefined));
  const myUserId = meta?.user_id ?? null;

  const myMember = useMemberStore((s) => {
    if (!serverId || !myUserId) return undefined;
    return s.members.get(serverId)?.get(myUserId);
  });

  const rolesMap = useRoleStore((s) => (serverId ? s.roles.get(serverId) : undefined));

  let perms = 0;
  if (myMember && rolesMap) {
    for (const roleId of myMember.roles) {
      const role = rolesMap.get(roleId);
      if (role) perms |= role.permissions;
    }
  }

  const isOwner = !!(meta && myUserId && meta.admin_user_id === myUserId);
  const isAdmin = isOwner || (perms & Permissions.ADMINISTRATOR) !== 0;
  const canMute = isAdmin || (perms & Permissions.MUTE_MEMBERS) !== 0;
  const canDeafen = isAdmin || (perms & Permissions.DEAFEN_MEMBERS) !== 0;

  return { canMute, canDeafen, myUserId };
}
