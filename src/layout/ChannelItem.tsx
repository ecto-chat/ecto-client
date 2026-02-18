import { memo, useCallback } from 'react';
import { Hash, BellOff, Star, FileText } from 'lucide-react';
import { Permissions } from 'ecto-shared';
import { useReadStateStore } from '@/stores/read-state';
import { useNotifyStore } from '@/stores/notify';
import { useServerStore } from '@/stores/server';
import { useUiStore } from '@/stores/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { connectionManager } from '@/services/connection-manager';
import { Badge } from '@/ui/Badge';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from '@/ui/ContextMenu';
import { VoiceChannel } from '@/features/voice';
import { cn } from '@/lib/cn';
import type { Channel } from 'ecto-shared';

interface ChannelItemProps {
  channel: Channel;
  isActive: boolean;
  onClick: (channel: Channel) => void;
}

export const ChannelItem = memo(function ChannelItem({
  channel,
  isActive,
  onClick,
}: ChannelItemProps) {
  const unread = useReadStateStore((s) => s.unreadCounts.get(channel.id) ?? 0);
  const mentions = useReadStateStore(
    (s) => s.mentionCounts.get(channel.id) ?? 0,
  );
  const isMuted = useNotifyStore((s) => s.mutedChannels.has(channel.id));
  const activeServerId = useUiStore((s) => s.activeServerId);
  const { isAdmin, effectivePermissions } = usePermissions(activeServerId);
  const canManageChannels = isAdmin || (effectivePermissions & Permissions.MANAGE_CHANNELS) !== 0;
  const isDefault = useServerStore(
    (s) => activeServerId ? s.serverMeta.get(activeServerId)?.default_channel_id === channel.id : false,
  );

  const handleToggleMute = useCallback(() => {
    useNotifyStore.getState().toggleMuteChannel(channel.id);
  }, [channel.id]);

  const handleSetDefault = useCallback(() => {
    if (!activeServerId) return;
    const newDefault = isDefault ? null : channel.id;
    connectionManager.getServerTrpc(activeServerId)?.server.update
      .mutate({ default_channel_id: newDefault })
      .then(() => {
        const meta = useServerStore.getState().serverMeta.get(activeServerId);
        if (meta) {
          useServerStore.getState().setServerMeta(activeServerId, {
            ...meta,
            default_channel_id: newDefault,
          });
        }
      })
      .catch(() => {});
  }, [activeServerId, channel.id, isDefault]);

  if (channel.type === 'voice') {
    return <VoiceChannel channel={channel} isActive={isActive} />;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 mx-1 rounded-md cursor-pointer transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-accent/40 outline-none',
            isActive && 'bg-active text-primary',
            !isActive && 'hover:bg-hover',
            !isActive && unread > 0 && !isMuted && 'font-semibold text-primary',
            !isActive && unread === 0 && 'text-secondary',
            isMuted && 'opacity-50',
          )}
          onClick={() => onClick(channel)}
        >
          {channel.type === 'page' ? (
            <FileText size={16} className="shrink-0 text-muted" />
          ) : (
            <Hash size={16} className="shrink-0 text-muted" />
          )}
          <span className="text-sm truncate">{channel.name}</span>
          {isDefault && (
            <Star size={12} className="shrink-0 text-warning fill-warning ml-auto" />
          )}
          {isMuted && !isDefault && (
            <span className="shrink-0 ml-auto text-muted" title="Muted">
              <BellOff size={14} />
            </span>
          )}
          {mentions > 0 && (
            <Badge variant="danger" size="sm" className="ml-auto shrink-0">
              {mentions}
            </Badge>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleToggleMute}>
          {isMuted ? 'Unmute Channel' : 'Mute Channel'}
        </ContextMenuItem>
        {canManageChannels && (
          <ContextMenuItem onClick={handleSetDefault}>
            {isDefault ? 'Unset Default Channel' : 'Set as Default Channel'}
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
});
