import { Check, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DiscoveryServer } from 'ecto-shared';
import { Avatar } from '@/ui/Avatar';
import { useUiStore } from '@/stores/ui';
import { useServerStore } from '@/stores/server';
import { useDiscoverStore } from '@/stores/discover';
import { connectionManager } from '@/services/connection-manager';

interface FeaturedServerCardProps {
  server: DiscoveryServer;
}

export function FeaturedServerCard({ server }: FeaturedServerCardProps) {
  const navigate = useNavigate();
  const liveStats = useDiscoverStore((s) => s.serverStats.get(server.server_id));
  const memberCount = liveStats?.member_count ?? server.member_count;
  const onlineCount = liveStats?.online_count ?? server.online_count;

  const joinedServerId = useServerStore((s) => {
    for (const [id, entry] of s.servers) {
      if (entry.server_address === server.address) return id;
    }
    return null;
  });

  const handleClick = () => {
    if (joinedServerId) {
      useUiStore.getState().setActiveServer(joinedServerId);
      const meta = useServerStore.getState().serverMeta.get(joinedServerId);
      const defaultChannelId = meta?.default_channel_id;
      if (defaultChannelId) {
        useUiStore.getState().setActiveChannel(defaultChannelId);
        navigate(`/servers/${joinedServerId}/channels/${defaultChannelId}`);
      } else {
        navigate(`/servers/${joinedServerId}/channels`);
      }
      connectionManager.switchServer(joinedServerId).catch(() => {});
    } else {
      useUiStore.getState().openModal('add-server', { initialAddress: server.address });
    }
  };

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-border bg-tertiary p-4 hover:bg-secondary transition-colors cursor-pointer"
      onClick={handleClick}
    >
      <div className="flex items-center gap-3">
        <Avatar src={server.icon_url} username={server.name} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-primary">{server.name}</p>
          {server.description && (
            <p className="text-xs text-muted truncate">{server.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-success" />
            {onlineCount.toLocaleString()} Online
          </span>
          <span>{memberCount.toLocaleString()} Members</span>
        </div>

        {joinedServerId ? (
          <span className="flex items-center gap-1 text-xs font-medium text-success">
            <Check size={12} /> Joined
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-semibold text-accent">
            <Plus size={12} /> Join
          </span>
        )}
      </div>
    </div>
  );
}
