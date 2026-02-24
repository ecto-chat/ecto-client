import { useNavigate } from 'react-router-dom';
import { CheckCheck } from 'lucide-react';

import { ScrollArea, Separator, IconButton } from '@/ui';
import { useActivityStore } from '@/stores/activity';
import { useUiStore } from '@/stores/ui';
import { useServerDmStore } from '@/stores/server-dm';
import { connectionManager } from '@/services/connection-manager';
import { useActivityActions } from './useActivityActions';
import { ActivityRow } from './ActivityRow';
import { UserBar } from '@/layout/UserBar';

import type { ActivityItem } from 'ecto-shared';

export function ActivityPanel() {
  const items = useActivityStore((s) => s.items);
  const { markRead, markAllRead } = useActivityActions();
  const navigate = useNavigate();

  const notifications = items.filter((i) => i.type !== 'server_dm');
  const serverDms = items.filter((i) => i.type === 'server_dm');

  const handleItemClick = (item: ActivityItem) => {
    if (!item.read) {
      markRead([item.id]);
    }

    // Navigate to the source location
    if (item.source.server_id === 'central' && item.source.peer_user_id) {
      // Central DM — navigate to DM view
      useUiStore.getState().setActiveServer(null);
      navigate(`/dms/${item.source.peer_user_id}`);
    } else if (item.type === 'server_dm' && item.source.conversation_id) {
      // Server DM — switch to server, open server DMs hub, select + mark read
      const serverId = item.source.server_id;
      const convoId = item.source.conversation_id;
      useUiStore.getState().setActiveServer(serverId);
      useUiStore.getState().setHubSection('server-dms');
      useServerDmStore.getState().setActiveConversation(convoId);
      useServerDmStore.getState().markConversationRead(serverId, convoId);
      connectionManager.switchServer(serverId).catch(() => {});
      // Persist read state to server
      const convo = useServerDmStore.getState().conversations.get(convoId);
      const lastMsgId = convo?.last_message?.id;
      if (lastMsgId) {
        connectionManager.getServerTrpc(serverId)?.serverDms.markRead
          .mutate({ conversation_id: convoId, last_read_message_id: lastMsgId })
          .catch(() => {});
      }
      navigate(`/servers/${serverId}/channels`);
    } else if (item.source.channel_id) {
      // Server channel notification — navigate to server + channel
      useUiStore.getState().setActiveServer(item.source.server_id);
      useUiStore.getState().setActiveChannel(item.source.channel_id);
      connectionManager.switchServer(item.source.server_id).catch(() => {});
      navigate(`/servers/${item.source.server_id}/channels/${item.source.channel_id}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-secondary">
      <div className="flex h-[60px] shrink-0 items-center justify-between px-4 border-b-2 border-primary">
        <h2 className="text-sm font-semibold text-primary">Activity</h2>
        <IconButton
          variant="ghost"
          size="sm"
          onClick={markAllRead}
          tooltip="Mark all read"
        >
          <CheckCheck size={16} />
        </IconButton>
      </div>

      <ScrollArea className="flex-1" fadeEdges fadeHeight={40}>
        {notifications.length > 0 && (
          <>
            <p className="uppercase tracking-wider text-xs text-muted font-semibold px-4 py-2">
              Notifications
            </p>
            {notifications.map((item, index) => (
              <ActivityRow
                key={item.id}
                item={item}
                index={index}
                onClick={handleItemClick}
              />
            ))}
          </>
        )}

        {notifications.length > 0 && serverDms.length > 0 && (
          <Separator className="my-2 mx-2" />
        )}

        {serverDms.length > 0 && (
          <>
            <p className="uppercase tracking-wider text-xs text-muted font-semibold px-4 py-2">
              Server DMs
            </p>
            {serverDms.map((item, index) => (
              <ActivityRow
                key={item.id}
                item={item}
                index={index}
                onClick={handleItemClick}
              />
            ))}
          </>
        )}

        {items.length === 0 && (
          <p className="text-sm text-muted text-center py-8">No activity yet</p>
        )}
      </ScrollArea>

      <UserBar />
    </div>
  );
}
