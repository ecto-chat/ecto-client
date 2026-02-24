import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useServerStore } from '@/stores/server';
import { useUiStore } from '@/stores/ui';
import { connectionManager } from '@/services/connection-manager';
import { ScrollArea } from '@/ui/ScrollArea';
import { Separator } from '@/ui/Separator';
import { HomeButton } from './HomeButton';
import { ActivityBell } from './ActivityBell';
import { AddServerButton } from './AddServerButton';
import { ServerList } from './ServerList';

export function ServerSidebar() {
  const serverOrder = useServerStore((s) => s.serverOrder);
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useUiStore((s) => s.activeServerId);
  const location = useLocation();
  const navigate = useNavigate();

  const isActivityRoute = location.pathname.startsWith('/activity');

  const handleServerClick = useCallback((serverId: string) => {
    useUiStore.getState().setActiveServer(serverId);
    const meta = useServerStore.getState().serverMeta.get(serverId);
    const defaultChannelId = meta?.default_channel_id;
    if (defaultChannelId) {
      useUiStore.getState().setActiveChannel(defaultChannelId);
      navigate(`/servers/${serverId}/channels/${defaultChannelId}`);
    } else {
      useUiStore.getState().setActiveChannel(null);
      navigate(`/servers/${serverId}/channels`);
    }
    connectionManager.switchServer(serverId).catch(() => {});
  }, [navigate]);

  return (
    <div className="flex h-full w-[72px] shrink-0 flex-col items-center py-3 gap-2">
      <HomeButton />
      <ActivityBell />
      <Separator className="mx-auto w-8" />

      <ScrollArea className="flex-1 w-full" overflowX="visible" fadeEdges fadeHeight={40}>
        <div className="flex flex-col items-center gap-0.5">
          <ServerList
            serverOrder={serverOrder}
            servers={servers}
            activeServerId={isActivityRoute ? null : activeServerId}
            onServerClick={handleServerClick}
          />
        </div>
      </ScrollArea>

      <AddServerButton />
    </div>
  );
}
