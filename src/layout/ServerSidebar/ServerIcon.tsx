import { memo, useCallback } from 'react';
import { motion } from 'motion/react';
import { WifiOff, BellOff, CheckCheck, DoorOpen, Trash2 } from 'lucide-react';
import { useNotifyStore } from '@/stores/notify';
import { useReadStateStore } from '@/stores/read-state';
import { useConnectionStore } from '@/stores/connection';
import { useChannelStore } from '@/stores/channel';
import { connectionManager } from '@/services/connection-manager';
import { useUiStore } from '@/stores/ui';
import { useServerStore } from '@/stores/server';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { IconButton } from '@/ui/IconButton';
import { Tooltip } from '@/ui/Tooltip';
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent,
  ContextMenuItem, ContextMenuSeparator,
} from '@/ui/ContextMenu';
import { cn } from '@/lib/cn';
import { springSnappy } from '@/lib/animations';
import type { ServerListEntry } from 'ecto-shared';

interface ServerIconProps {
  serverId: string;
  server: ServerListEntry;
  isActive: boolean;
  onClick: (serverId: string) => void;
}

export const ServerIcon = memo(function ServerIcon({
  serverId, server, isActive, onClick,
}: ServerIconProps) {
  const hasUnread = useNotifyStore((s) => {
    const n = s.notifications.get(serverId);
    return n !== undefined && n.size > 0;
  });
  const isMuted = useNotifyStore((s) => s.mutedServers.has(serverId));
  const status = useConnectionStore((s) => s.connections.get(serverId));
  const isOffline = !status || status === 'disconnected';
  const mentions = useReadStateStore((s) => {
    const chs = useChannelStore.getState().channels.get(serverId);
    if (!chs) return 0;
    let t = 0;
    for (const id of chs.keys()) t += s.mentionCounts.get(id) ?? 0;
    return t;
  });

  const handleClick = useCallback(() => onClick(serverId), [onClick, serverId]);

  const markAllRead = useCallback(() => {
    const chs = useChannelStore.getState().channels.get(serverId);
    if (chs) useReadStateStore.getState().markAllRead([...chs.keys()]);
    useNotifyStore.getState().clearNotifications(serverId);
    connectionManager.getServerTrpc(serverId)?.read_state.markAllRead.mutate().catch(() => {});
  }, [serverId]);

  const toggleMute = useCallback(() => {
    useNotifyStore.getState().toggleMuteServer(serverId);
  }, [serverId]);

  const leaveServer = useCallback(() => {
    useUiStore.getState().openModal('leave-server', {
      serverId, serverName: server.server_name ?? serverId,
    });
  }, [serverId, server.server_name]);

  const removeServer = useCallback(() => {
    const central = connectionManager.getCentralTrpc();
    if (central && server.server_address)
      central.servers.remove.mutate({ server_address: server.server_address }).catch(() => {});
    connectionManager.disconnectFromServer(serverId);
    connectionManager.removeStoredServerSession(serverId).catch(() => {});
    connectionManager.stopServerRetry(server.server_address ?? serverId);
    useServerStore.getState().removeServer(serverId);
    if (useUiStore.getState().activeServerId === serverId)
      useUiStore.getState().setActiveServer(null);
  }, [serverId, server.server_address]);

  const name = server.server_name ?? serverId;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="group relative flex w-full items-center justify-center py-1">
          <motion.div
            className="absolute left-0 w-1 rounded-r-full bg-primary"
            initial={false}
            animate={{
              height: isActive ? 40 : hasUnread && !isActive ? 8 : 0,
              opacity: isActive || (hasUnread && !isActive) ? 1 : 0,
            }}
            transition={springSnappy}
          />
          <div className="relative">
            {mentions > 0 && (
              <div className="absolute -top-1 -left-1 z-10">
                <Badge variant="danger" size="md" className="ring-3 ring-[var(--color-bg-secondary)]">{mentions}</Badge>
              </div>
            )}
            {isMuted && (
              <div className="absolute -top-0.5 -right-0.5 z-10 text-muted">
                <BellOff size={12} />
              </div>
            )}
            <Tooltip content={isOffline ? `${name} (Offline)` : name} side="right">
              <IconButton
                variant="default"
                size="lg"
                onClick={handleClick}
                className={cn(
                  'h-12 w-12 overflow-hidden transition-[border-radius,background-color,color] duration-150',
                  isActive ? 'rounded-2xl bg-accent' : 'rounded-full bg-tertiary hover:rounded-2xl hover:bg-accent',
                  isOffline && 'opacity-50',
                )}
              >
                {isOffline
                  ? <WifiOff size={20} className="text-muted" />
                  : <Avatar src={server.server_icon ?? undefined} username={name} size={48} />}
              </IconButton>
            </Tooltip>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={markAllRead}>
          <CheckCheck size={14} className="mr-2" />Mark All as Read
        </ContextMenuItem>
        <ContextMenuItem onSelect={toggleMute}>
          <BellOff size={14} className="mr-2" />{isMuted ? 'Unmute Server' : 'Mute Server'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={leaveServer}>
          <DoorOpen size={14} className="mr-2" />Leave Server
        </ContextMenuItem>
        {isOffline && (
          <ContextMenuItem danger onSelect={removeServer}>
            <Trash2 size={14} className="mr-2" />Remove Server
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
});
