import { Button } from '@/ui';

import { useChannelStore } from '@/stores/channel';
import { useServerStore } from '@/stores/server';

import { useVoice } from '@/hooks/useVoice';

export function VoiceBanner() {
  const { currentChannelId, currentServerId, leaveVoice } = useVoice();

  if (!currentServerId || !currentChannelId) return null;

  const channelName =
    useChannelStore.getState().channels.get(currentServerId)?.get(currentChannelId)?.name ?? 'Voice';
  const serverName =
    useServerStore.getState().servers.get(currentServerId)?.server_name ?? 'Server';

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 bg-accent-subtle border border-accent/20 rounded-lg">
      <span className="text-xs text-secondary truncate">
        Connected to <span className="font-medium text-primary">#{channelName}</span> on{' '}
        <span className="font-medium text-primary">{serverName}</span>
      </span>
      <Button variant="danger" size="sm" onClick={leaveVoice}>
        Disconnect
      </Button>
    </div>
  );
}
