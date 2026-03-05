import { useNavigate } from 'react-router-dom';
import type { DiscoveryPost } from 'ecto-shared';
import { useServerStore } from '@/stores/server';
import { useChannelStore } from '@/stores/channel';
import { useUiStore } from '@/stores/ui';
import { connectionManager } from '@/services/connection-manager';

export function usePostClick() {
  const navigate = useNavigate();

  return (post: DiscoveryPost) => {
    const isMember = useServerStore.getState().servers.has(post.server_id);

    if (!isMember) {
      // Open join server modal
      useUiStore.getState().openModal('server-join', { address: post.server_address });
      return;
    }

    // Already a member — find the news channel and navigate to the post
    const serverChannels = useChannelStore.getState().channels.get(post.server_id);
    let newsChannelId: string | null = null;
    if (serverChannels) {
      for (const [id, ch] of serverChannels) {
        if (ch.type === 'news') {
          newsChannelId = id;
          break;
        }
      }
    }

    useUiStore.getState().setActiveServer(post.server_id);
    connectionManager.switchServer(post.server_id).catch(() => {});

    if (newsChannelId) {
      useUiStore.getState().setActiveChannel(newsChannelId);
      navigate(`/servers/${post.server_id}/channels/${newsChannelId}?post=${post.id}`);
    } else {
      // Fallback — no news channel found, just navigate to server
      const meta = useServerStore.getState().serverMeta.get(post.server_id);
      const defaultChannel = meta?.default_channel_id;
      if (defaultChannel) {
        useUiStore.getState().setActiveChannel(defaultChannel);
        navigate(`/servers/${post.server_id}/channels/${defaultChannel}`);
      } else {
        navigate(`/servers/${post.server_id}/channels`);
      }
    }
  };
}
