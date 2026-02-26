import { useNavigate } from 'react-router-dom';
import { useServerDmStore } from '@/stores/server-dm';
import { useUiStore } from '@/stores/ui';
import { connectionManager } from '@/services/connection-manager';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { usePresence } from '@/hooks/usePresence';
import { cn } from '@/lib/cn';
import type { ServerDmConversation } from 'ecto-shared';

function ConversationItem({
  convo,
  isActive,
  onClick,
}: {
  convo: ServerDmConversation;
  isActive: boolean;
  onClick: () => void;
}) {
  const { status } = usePresence(convo.peer.user_id);
  const unreadCount = useServerDmStore((s) => s.conversationUnreads.get(convo.id) ?? 0);
  const peerName = convo.peer.nickname ?? convo.peer.display_name ?? convo.peer.username;
  const lastMsg = convo.last_message;
  const preview = lastMsg?.content?.slice(0, 80) ?? '';
  const hasUnread = unreadCount > 0;

  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors duration-150',
        isActive
          ? 'bg-primary text-primary'
          : hasUnread
            ? 'bg-hover text-primary hover:bg-primary'
            : 'text-secondary hover:bg-hover',
      )}
      onClick={onClick}
    >
      <Avatar
        src={convo.peer.avatar_url ?? undefined}
        username={peerName}
        size={36}
        status={status}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className={cn('truncate text-sm', hasUnread ? 'font-semibold text-primary' : 'font-medium')}>{peerName}</span>
          {hasUnread && (
            <Badge variant="default" size="sm" className="ml-1 shrink-0 bg-[#7c5cfc]">{unreadCount}</Badge>
          )}
        </div>
        {preview && (
          <p className={cn('truncate text-xs', hasUnread ? 'text-secondary font-medium' : 'text-muted')}>{preview}</p>
        )}
      </div>
    </button>
  );
}

export function ServerDmConversationList() {
  const conversations = useServerDmStore((s) => s.conversations);
  const activeId = useServerDmStore((s) => s.activeConversationId);
  const navigate = useNavigate();

  const sorted = [...conversations.values()].sort((a, b) => {
    const aTime = a.last_message?.created_at ?? '';
    const bTime = b.last_message?.created_at ?? '';
    return bTime.localeCompare(aTime);
  });

  const handleSelect = (convoId: string) => {
    useServerDmStore.getState().setActiveConversation(convoId);
    const serverId = useUiStore.getState().activeServerId;
    if (serverId) {
      navigate(`/servers/${serverId}/dms/${convoId}`);
      useServerDmStore.getState().markConversationRead(serverId, convoId);
      // Persist read state to server
      const convo = useServerDmStore.getState().conversations.get(convoId);
      const lastMsgId = convo?.last_message?.id;
      if (lastMsgId && !convoId.startsWith('pending-')) {
        connectionManager.getServerTrpc(serverId)?.serverDms.markRead
          .mutate({ conversation_id: convoId, last_read_message_id: lastMsgId })
          .catch(() => {});
      }
    }
  };

  return (
    <div className="flex flex-col gap-0.5 overflow-y-auto p-2">
      {sorted.map((convo) => (
        <ConversationItem
          key={convo.id}
          convo={convo}
          isActive={convo.id === activeId}
          onClick={() => handleSelect(convo.id)}
        />
      ))}
      {sorted.length === 0 && (
        <p className="px-2 py-4 text-center text-xs text-muted">
          No conversations yet
        </p>
      )}
    </div>
  );
}
