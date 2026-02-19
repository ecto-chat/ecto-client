import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Maximize2, PhoneOff } from 'lucide-react';

import { IconButton } from '@/ui';

import { useChannelStore } from '@/stores/channel';
import { useServerStore } from '@/stores/server';
import { useUiStore } from '@/stores/ui';
import { useExpandMedia } from '@/features/media-window';
import { connectionManager } from '@/services/connection-manager';

import { useVoice } from '@/hooks/useVoice';

export function VoiceBanner() {
  const { currentChannelId, currentServerId, leaveVoice } = useVoice();
  const mediaViewMode = useUiStore((s) => s.mediaViewMode);
  const expandMedia = useExpandMedia();
  const navigate = useNavigate();

  const navigateToChannel = useCallback(() => {
    if (!currentServerId || !currentChannelId) return;
    useUiStore.getState().setActiveServer(currentServerId);
    useUiStore.getState().setActiveChannel(currentChannelId);
    connectionManager.switchServer(currentServerId).catch(() => {});
    navigate(`/servers/${currentServerId}/channels/${currentChannelId}`);
  }, [currentServerId, currentChannelId, navigate]);

  const navigateToServer = useCallback(() => {
    if (!currentServerId) return;
    useUiStore.getState().setActiveServer(currentServerId);
    connectionManager.switchServer(currentServerId).catch(() => {});
    navigate(`/servers/${currentServerId}`);
  }, [currentServerId, navigate]);

  if (!currentServerId || !currentChannelId) return null;

  const channelName =
    useChannelStore.getState().channels.get(currentServerId)?.get(currentChannelId)?.name ?? 'Voice';
  const serverName =
    useServerStore.getState().servers.get(currentServerId)?.server_name ?? 'Server';

  const isMinimized = mediaViewMode === 'floating' || mediaViewMode === 'snapped-left' || mediaViewMode === 'snapped-right';

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 bg-accent-subtle border-b border-accent/20">
      <span className="text-xs text-secondary truncate">
        Connected to{' '}
        <button onClick={navigateToChannel} className="font-medium text-primary hover:underline">
          #{channelName}
        </button>{' '}
        on{' '}
        <button onClick={navigateToServer} className="font-medium text-primary hover:underline">
          {serverName}
        </button>
      </span>
      <div className="flex items-center gap-1.5">
        {isMinimized && (
          <IconButton
            size="sm"
            variant="ghost"
            tooltip="Expand"
            onClick={expandMedia}
          >
            <Maximize2 className="size-3.5" />
          </IconButton>
        )}
        <IconButton
          size="sm"
          tooltip="Disconnect"
          onClick={leaveVoice}
          className="bg-danger text-white hover:bg-danger-hover"
        >
          <PhoneOff className="size-3.5" />
        </IconButton>
      </div>
    </div>
  );
}
