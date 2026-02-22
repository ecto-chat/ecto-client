import { memo, useCallback } from 'react';
import { Mail } from 'lucide-react';
import { usePresence } from '@/hooks/usePresence';
import { useUiStore } from '@/stores/ui';
import { useServerStore } from '@/stores/server';
import { useAuthStore } from '@/stores/auth';
import { useServerDmStore } from '@/stores/server-dm';
import { connectionManager } from '@/services/connection-manager';
import { Avatar } from '@/ui/Avatar';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from '@/ui/ContextMenu';
import { cn } from '@/lib/cn';
import type { Member, Role } from 'ecto-shared';

type MemberItemProps = {
  member: Member;
  rolesMap?: Map<string, Role>;
};

export const MemberItem = memo(function MemberItem({ member, rolesMap }: MemberItemProps) {
  const { status } = usePresence(member.user_id);
  const activeServerId = useUiStore((s) => s.activeServerId);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isOffline = status === 'offline';
  const isSelf = member.user_id === currentUserId;

  const allowMemberDms = useServerStore((s) =>
    activeServerId ? s.serverMeta.get(activeServerId)?.allow_member_dms ?? false : false,
  );

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

  const handleSendServerDm = useCallback(() => {
    if (!activeServerId) return;

    useUiStore.getState().setHubSection('server-dms');

    // Check if conversation already exists
    const conversations = useServerDmStore.getState().conversations;
    for (const [, convo] of conversations) {
      if (convo.peer.user_id === member.user_id) {
        useServerDmStore.getState().setActiveConversation(convo.id);
        return;
      }
    }

    // Create a placeholder conversation so the UI shows the chat.
    // The real conversation is created server-side on first message.
    const tempId = `pending-${member.user_id}`;
    useServerDmStore.getState().ensureConversation({
      id: tempId,
      peer: {
        user_id: member.user_id,
        username: member.username,
        display_name: member.display_name,
        avatar_url: member.avatar_url,
        nickname: member.nickname,
      },
      last_message: null,
      unread_count: 0,
    });
    useServerDmStore.getState().setActiveConversation(tempId);
  }, [activeServerId, member]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            'flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-hover focus-visible:ring-1 focus-visible:ring-accent/40 outline-none',
            isOffline && 'opacity-60',
          )}
          onClick={handleClick}
        >
          <Avatar
            src={member.avatar_url ?? undefined}
            username={member.nickname ?? member.display_name ?? member.username}
            size={32}
            status={status}
          />
          <div className="min-w-0 flex-1">
            <span
              className="block truncate text-sm font-medium text-primary"
              style={nameColor ? { color: nameColor } : undefined}
            >
              {member.nickname ?? member.display_name ?? member.username}
            </span>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleClick}>
          View Profile
        </ContextMenuItem>
        {allowMemberDms && !isSelf && (
          <ContextMenuItem onClick={handleSendServerDm}>
            <Mail size={14} className="mr-2" />
            Send Private Message
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
});
