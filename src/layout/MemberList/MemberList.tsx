import { useEffect, useMemo } from 'react';
import { Permissions } from 'ecto-shared';
import { useMembers } from '@/hooks/useMembers';
import { usePresenceStore } from '@/stores/presence';
import { useUiStore } from '@/stores/ui';
import { useServerStore } from '@/stores/server';
import { useRoleStore } from '@/stores/role';
import { ScrollArea } from '@/ui/ScrollArea';
import { MemberSection } from './MemberSection';
import type { Member } from 'ecto-shared';

const MODERATION_BITS =
  Permissions.KICK_MEMBERS |
  Permissions.BAN_MEMBERS |
  Permissions.MANAGE_ROLES |
  Permissions.MANAGE_MESSAGES;

export function MemberList() {
  const activeServerId = useUiStore((s) => s.activeServerId);
  const { members, loadMembers } = useMembers(activeServerId ?? '');
  const meta = useServerStore((s) =>
    activeServerId ? s.serverMeta.get(activeServerId) : undefined,
  );
  const rolesMap = useRoleStore((s) =>
    activeServerId ? s.roles.get(activeServerId) : undefined,
  );
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
        const isOnline =
          presence?.status === 'online' ||
          presence?.status === 'idle' ||
          presence?.status === 'dnd';
        if (isOnline) {
          onlineList.push(member);
        } else {
          offlineList.push(member);
        }
      }
    }

    return { admins: adminList, moderators: modList, online: onlineList, offline: offlineList };
  }, [members, meta, rolesMap, presences]);

  const sections = [
    { title: 'Admin', members: admins },
    { title: 'Moderators', members: moderators },
    { title: 'Online', members: online },
    { title: 'Offline', members: offline },
  ].filter((s) => s.members.length > 0);

  let runningOffset = 0;

  return (
    <div className="flex w-[240px] min-w-[240px] flex-col border-l border-border bg-secondary rounded-r-md overflow-hidden">
      <div className="flex h-[60px] shrink-0 items-center px-4 border-b border-border">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Members</h2>
      </div>
      <ScrollArea fadeEdges fadeHeight={40} className="flex-1">
        <div className="p-3">
          {sections.map((section, i) => {
            const offset = runningOffset;
            runningOffset += section.members.length;
            return (
              <MemberSection
                key={section.title}
                title={section.title}
                count={section.members.length}
                members={section.members}
                rolesMap={rolesMap}
                isFirst={i === 0}
                indexOffset={offset}
              />
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
