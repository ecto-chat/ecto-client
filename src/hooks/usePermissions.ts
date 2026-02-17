import { Permissions } from 'ecto-shared';
import { useServerStore } from '../stores/server.js';
import { useMemberStore } from '../stores/member.js';
import { useRoleStore } from '../stores/role.js';

type AllowedTabs = 'all' | string[];

/** Any permission that grants access to at least one settings tab */
const SETTINGS_BITS =
  Permissions.KICK_MEMBERS |
  Permissions.BAN_MEMBERS |
  Permissions.MANAGE_ROLES |
  Permissions.MANAGE_MESSAGES |
  Permissions.MANAGE_CHANNELS |
  Permissions.MANAGE_WEBHOOKS |
  Permissions.VIEW_AUDIT_LOG |
  Permissions.CREATE_INVITES;

/** Map of permission bit → settings tab(s) it unlocks */
const PERM_TAB_MAP: [number, string][] = [
  [Permissions.BAN_MEMBERS, 'bans'],
  [Permissions.MANAGE_ROLES, 'roles'],
  [Permissions.MANAGE_CHANNELS, 'channels'],
  [Permissions.MANAGE_WEBHOOKS, 'webhooks'],
  [Permissions.VIEW_AUDIT_LOG, 'audit-log'],
  [Permissions.CREATE_INVITES, 'invites'],
];

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
  const isModerator = !isAdmin && (effectivePermissions & SETTINGS_BITS) !== 0;
  const canAccessSettings = isAdmin || isModerator;

  let allowedTabs: AllowedTabs = [];
  if (isAdmin) {
    allowedTabs = 'all';
  } else if (isModerator) {
    // Members tab is viewable by anyone with settings access
    const tabs: string[] = ['members'];
    for (const [bit, tab] of PERM_TAB_MAP) {
      if (effectivePermissions & bit) tabs.push(tab);
    }
    allowedTabs = tabs;
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
