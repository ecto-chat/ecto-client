import { Permissions } from 'ecto-shared';
import { useServerStore } from '../stores/server.js';
import { useMemberStore } from '../stores/member.js';
import { useRoleStore } from '../stores/role.js';

type AllowedTabs = 'all' | string[];

const MODERATION_BITS =
  Permissions.KICK_MEMBERS |
  Permissions.BAN_MEMBERS |
  Permissions.MANAGE_ROLES |
  Permissions.MANAGE_MESSAGES;

export function usePermissions(serverId: string | null) {
  const meta = useServerStore((s) => (serverId ? s.serverMeta.get(serverId) : undefined));
  const myUserId = meta?.user_id ?? null;

  const member = useMemberStore((s) => {
    if (!serverId || !myUserId) return undefined;
    return s.members.get(serverId)?.get(myUserId);
  });

  const rolesMap = useRoleStore((s) => (serverId ? s.roles.get(serverId) : undefined));

  // Compute effective permissions by OR-ing all assigned role permission bits
  let effectivePermissions = 0;
  if (member && rolesMap) {
    for (const roleId of member.roles) {
      const role = rolesMap.get(roleId);
      if (role) {
        effectivePermissions |= role.permissions;
      }
    }
  }

  const isOwner = !!(meta && myUserId && meta.admin_user_id === myUserId);
  const isAdmin = isOwner || (effectivePermissions & Permissions.ADMINISTRATOR) !== 0;
  const isModerator = !isAdmin && (effectivePermissions & MODERATION_BITS) !== 0;
  const canAccessSettings = isAdmin || isModerator;

  let allowedTabs: AllowedTabs = [];
  if (isAdmin) {
    allowedTabs = 'all';
  } else if (isModerator) {
    allowedTabs = ['members', 'bans'];
  }

  return {
    isOwner,
    isAdmin,
    isModerator,
    canAccessSettings,
    allowedTabs,
    effectivePermissions,
  };
}
