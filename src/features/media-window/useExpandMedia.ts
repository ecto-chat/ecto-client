import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { useUiStore, useVoiceStore, connectionManager } from 'ecto-core';

/**
 * Returns a function that expands the media window to fullscreen.
 * For voice channels, this also navigates to the voice server/channel.
 * For calls, it just sets the mode (the overlay renders on top of everything).
 */
export function useExpandMedia() {
  const navigate = useNavigate();

  return useCallback(() => {
    const voiceServerId = useVoiceStore.getState().currentServerId;
    const voiceChannelId = useVoiceStore.getState().currentChannelId;

    useUiStore.getState().setMediaViewMode('fullscreen');

    // If in a voice channel, navigate to it
    if (voiceServerId && voiceChannelId) {
      useUiStore.getState().setActiveServer(voiceServerId);
      useUiStore.getState().setActiveChannel(voiceChannelId);
      connectionManager.switchServer(voiceServerId).catch(() => {});
      navigate(`/servers/${voiceServerId}/channels/${voiceChannelId}`);
    }
  }, [navigate]);
}
