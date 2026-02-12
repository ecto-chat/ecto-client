import { useCallback } from 'react';
import { useChannelStore } from '../stores/channel.js';
import { useUiStore } from '../stores/ui.js';
import { connectionManager } from '../services/connection-manager.js';

export function useChannels(serverId: string) {
  const channels = useChannelStore((s) => s.channels.get(serverId));
  const channelOrder = useChannelStore((s) => s.channelOrder.get(serverId));
  const categories = useChannelStore((s) => s.categories.get(serverId));

  const openChannel = useCallback(
    (channelId: string) => {
      useUiStore.getState().setActiveChannel(channelId);
      const ws = connectionManager.getMainWs(serverId);
      ws?.subscribe(channelId);
    },
    [serverId],
  );

  const closeChannel = useCallback(
    (channelId: string) => {
      const ws = connectionManager.getMainWs(serverId);
      ws?.unsubscribe(channelId);
    },
    [serverId],
  );

  const orderedChannels = channelOrder
    ?.map((id) => channels?.get(id))
    .filter((c): c is NonNullable<typeof c> => c != null);

  return {
    channels: orderedChannels ?? [],
    channelsMap: channels ?? new Map(),
    categories: categories ?? new Map(),
    openChannel,
    closeChannel,
  };
}
