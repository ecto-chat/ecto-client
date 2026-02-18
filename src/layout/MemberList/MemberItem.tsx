import { memo } from 'react';
import { usePresence } from '@/hooks/usePresence';
import { useUiStore } from '@/stores/ui';
import { Avatar } from '@/ui/Avatar';
import { cn } from '@/lib/cn';
import type { Member, Role } from 'ecto-shared';

type MemberItemProps = {
  member: Member;
  rolesMap?: Map<string, Role>;
};

export const MemberItem = memo(function MemberItem({ member, rolesMap }: MemberItemProps) {
  const { status } = usePresence(member.user_id);
  const activeServerId = useUiStore((s) => s.activeServerId);
  const isOffline = status === 'offline';

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
    useUiStore.getState().openModal('user-profile', {
      userId: member.user_id,
      serverId: activeServerId,
    });
  };

  return (
    <div
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-hover focus-visible:ring-1 focus-visible:ring-accent/40 outline-none',
        isOffline && 'opacity-60',
      )}
      onClick={handleClick}
    >
      <Avatar
        src={member.avatar_url ?? undefined}
        username={member.nickname ?? member.username}
        size={32}
        status={status}
      />
      <div className="min-w-0 flex-1">
        <span
          className="block truncate text-sm font-medium text-primary"
          style={nameColor ? { color: nameColor } : undefined}
        >
          {member.nickname ?? member.username}
        </span>
      </div>
    </div>
  );
});
