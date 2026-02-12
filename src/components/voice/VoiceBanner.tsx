import { useVoice } from '../../hooks/useVoice.js';
import { useChannelStore } from '../../stores/channel.js';
import { useServerStore } from '../../stores/server.js';

export function VoiceBanner() {
  const { currentChannelId, currentServerId, leaveVoice } = useVoice();

  if (!currentServerId || !currentChannelId) return null;

  const channelName = useChannelStore.getState().channels.get(currentServerId)?.get(currentChannelId)?.name ?? 'Voice';
  const serverName = useServerStore.getState().servers.get(currentServerId)?.server_name ?? 'Server';

  return (
    <div className="voice-banner">
      <span className="voice-banner-text">
        Connected to <strong>#{channelName}</strong> on <strong>{serverName}</strong>
      </span>
      <button className="voice-banner-disconnect" onClick={leaveVoice}>
        Disconnect
      </button>
    </div>
  );
}
