import { Check, Plus, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DiscoveryServer } from 'ecto-shared';
import { Avatar } from '@/ui/Avatar';
import { useToast } from '@/ui/Toast';
import { useUiStore } from '@/stores/ui';
import { useServerStore } from '@/stores/server';
import { useDiscoverStore } from '@/stores/discover';
import { connectionManager } from '@/services/connection-manager';

interface SearchServerCardProps {
  server: DiscoveryServer;
}

export function SearchServerCard({ server }: SearchServerCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const onlineStatus = useDiscoverStore((s) => s.searchOnlineStatus.get(server.server_id));
  const isSelfHosted = !server.address.endsWith('.ecto.chat');
  const isOffline = isSelfHosted && onlineStatus === false;

  const joinedServerId = useServerStore((s) => {
    for (const [id, entry] of s.servers) {
      if (entry.server_address === server.address) return id;
    }
    return null;
  });

  const handleClick = () => {
    if (isOffline) {
      toast('This server is currently offline. Contact the server admin.', 'warning');
      return;
    }

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
      className={`flex flex-col gap-3 rounded-lg border border-border bg-tertiary p-4 transition-colors cursor-pointer ${isOffline ? 'opacity-60 hover:bg-tertiary' : 'hover:bg-secondary'}`}
      onClick={handleClick}
    >
      <div className="flex items-center gap-3">
        <Avatar src={server.icon_url} username={server.name} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-primary">{server.name}</p>
            {isSelfHosted && (
              onlineStatus === false ? (
                <WifiOff size={14} className="shrink-0 text-danger" />
              ) : onlineStatus === true ? (
                <span className="shrink-0 inline-block h-2 w-2 rounded-full bg-success" />
              ) : null
            )}
          </div>
          {server.description && (
            <p className="text-xs text-muted truncate">{server.description}</p>
          )}
        </div>
      </div>

      {server.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {server.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center rounded-md bg-accent/10 text-accent/80 px-1.5 py-0.5 text-[10px] font-medium">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-success" />
            {server.online_count.toLocaleString()} Online
          </span>
          <span>{server.member_count.toLocaleString()} Members</span>
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
