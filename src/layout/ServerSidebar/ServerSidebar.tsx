import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useServerStore } from '@/stores/server';
import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';
import { connectionManager } from '@/services/connection-manager';
import { fullLogout } from '@/stores/reset';
import { getAccountCount } from '@/services/account-registry';
import { IconButton } from '@/ui/IconButton';
import { ScrollArea } from '@/ui/ScrollArea';
import { Separator } from '@/ui/Separator';
import { Tooltip } from '@/ui/Tooltip';
import { HomeButton } from './HomeButton';
import { AddServerButton } from './AddServerButton';
import { ServerList } from './ServerList';
import { AccountSwitcher } from './AccountSwitcher';

export function ServerSidebar() {
  const serverOrder = useServerStore((s) => s.serverOrder);
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useUiStore((s) => s.activeServerId);
  const isCentralAuth = useAuthStore((s) => s.isCentralAuth());
  const navigate = useNavigate();

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

  const handleSignOut = useCallback(() => {
    fullLogout().then(() => navigate('/landing'));
  }, [navigate]);

  const showAccountSwitcher = isCentralAuth && getAccountCount() >= 1;

  return (
    <div className="flex h-full w-[72px] shrink-0 flex-col items-center border-r border-border bg-secondary py-3 gap-2">
      <HomeButton />
      <Separator className="mx-auto w-8" />

      <ScrollArea className="flex-1 w-full" overflowX="visible" fadeEdges fadeHeight={40}>
        <div className="flex flex-col items-center gap-0.5">
          <ServerList
            serverOrder={serverOrder}
            servers={servers}
            activeServerId={activeServerId}
            onServerClick={handleServerClick}
          />
        </div>
      </ScrollArea>

      <AddServerButton />
      <div className="flex-1" />

      {showAccountSwitcher ? (
        <AccountSwitcher />
      ) : (
        <Tooltip content="Sign Out" side="right">
          <IconButton
            variant="default"
            size="lg"
            onClick={handleSignOut}
            className="h-12 w-12 rounded-full bg-tertiary text-secondary transition-[border-radius,background-color,color] duration-150 hover:rounded-2xl hover:bg-danger hover:text-white"
          >
            <LogOut size={20} />
          </IconButton>
        </Tooltip>
      )}
    </div>
  );
}
