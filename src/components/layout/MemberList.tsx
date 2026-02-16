import { useEffect, useMemo, memo } from 'react';
import { Permissions } from 'ecto-shared';
import { useMembers } from '../../hooks/useMembers.js';
import { usePresenceStore } from '../../stores/presence.js';
import { usePresence } from '../../hooks/usePresence.js';
import { useUiStore } from '../../stores/ui.js';
import { useServerStore } from '../../stores/server.js';
import { useRoleStore } from '../../stores/role.js';
import { Avatar } from '../common/Avatar.js';
import type { Member, Role } from 'ecto-shared';

const MODERATION_BITS =
  Permissions.KICK_MEMBERS |
  Permissions.BAN_MEMBERS |
  Permissions.MANAGE_ROLES |
  Permissions.MANAGE_MESSAGES;

export function MemberList() {
  const activeServerId = useUiStore((s) => s.activeServerId);
  const { members, loadMembers } = useMembers(activeServerId ?? '');
  const meta = useServerStore((s) => (activeServerId ? s.serverMeta.get(activeServerId) : undefined));
  const rolesMap = useRoleStore((s) => (activeServerId ? s.roles.get(activeServerId) : undefined));
  const presences = usePresenceStore((s) => s.presences);

  useEffect(() => {
    if (activeServerId) {
      loadMembers().catch(() => {});
    }
  }, [activeServerId, loadMembers]);

  const { admins, moderators, online, offline } = useMemo(() => {
    const adminList: Member[] = [];
    const modList: Member[] = [];
    const onlineList: Member[] = [];
    const offlineList: Member[] = [];

    for (const member of members) {
      const isOwner = meta?.admin_user_id === member.user_id;

      // Compute effective permissions from member's roles
      let perms = 0;
      if (rolesMap) {
        for (const roleId of member.roles) {
          const role = rolesMap.get(roleId);
          if (role) perms |= role.permissions;
        }
      }

      const isAdminPerm = (perms & Permissions.ADMINISTRATOR) !== 0;
      const isModPerm = (perms & MODERATION_BITS) !== 0;

      if (isOwner || isAdminPerm) {
        adminList.push(member);
      } else if (isModPerm) {
        modList.push(member);
      } else {
        const presence = presences.get(member.user_id);
        const isOnline = presence?.status === 'online' || presence?.status === 'idle' || presence?.status === 'dnd';
        if (isOnline) {
          onlineList.push(member);
        } else {
          offlineList.push(member);
        }
      }
    }

    return { admins: adminList, moderators: modList, online: onlineList, offline: offlineList };
  }, [members, meta, rolesMap, presences]);

  return (
    <div className="member-list">
      {admins.length > 0 && (
        <div className="member-list-section">
          <h3 className="member-list-header">Admin — {admins.length}</h3>
          {admins.map((member) => (
            <MemberItem key={member.user_id} member={member} rolesMap={rolesMap} />
          ))}
        </div>
      )}

      {moderators.length > 0 && (
        <div className="member-list-section">
          <h3 className="member-list-header">Moderators — {moderators.length}</h3>
          {moderators.map((member) => (
            <MemberItem key={member.user_id} member={member} rolesMap={rolesMap} />
          ))}
        </div>
      )}

      {online.length > 0 && (
        <div className="member-list-section">
          <h3 className="member-list-header">Online — {online.length}</h3>
          {online.map((member) => (
            <MemberItem key={member.user_id} member={member} rolesMap={rolesMap} />
          ))}
        </div>
      )}

      {offline.length > 0 && (
        <div className="member-list-section">
          <h3 className="member-list-header">Offline — {offline.length}</h3>
          {offline.map((member) => (
            <MemberItem key={member.user_id} member={member} rolesMap={rolesMap} />
          ))}
        </div>
      )}
    </div>
  );
}

const MemberItem = memo(function MemberItem({ member, rolesMap }: { member: Member; rolesMap?: Map<string, Role> }) {
  const { status } = usePresence(member.user_id);
  const activeServerId = useUiStore((s) => s.activeServerId);

  // Find highest-position role with a color
  let nameColor: string | undefined;
  if (rolesMap) {
    let bestPosition = -1;
    for (const roleId of member.roles) {
      const role = rolesMap.get(roleId);
      if (role?.color && role.position > bestPosition) {
        bestPosition = role.position;
        nameColor = role.color;
      }
    }
  }

  const handleClick = () => {
    if (!activeServerId) return;
    useUiStore.getState().openModal('user-profile', { userId: member.user_id, serverId: activeServerId });
  };

  return (
    <div className="member-item" onClick={handleClick}>
      <Avatar
        src={member.avatar_url ?? undefined}
        username={member.nickname ?? member.username}
        size={32}
        status={status}
      />
      <div className="member-info">
        <span className="member-name" style={nameColor ? { color: nameColor } : undefined}>
          {member.nickname ?? member.username}
        </span>
      </div>
    </div>
  );
});
