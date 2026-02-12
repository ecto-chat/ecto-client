import { useVoice } from '../../hooks/useVoice.js';
import { useChannelStore } from '../../stores/channel.js';
import { useServerStore } from '../../stores/server.js';

export function VoiceControls() {
  const {
    currentChannelId,
    currentServerId,
    voiceStatus,
    selfMuted,
    selfDeafened,
    isInVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    toggleCamera,
  } = useVoice();

  if (!isInVoice || !currentServerId || !currentChannelId) return null;

  const channelName = useChannelStore.getState().channels.get(currentServerId)?.get(currentChannelId)?.name ?? 'Voice';
  const serverName = useServerStore.getState().servers.get(currentServerId)?.server_name ?? 'Server';

  return (
    <div className="voice-controls">
      <div className="voice-controls-info">
        <div className={`voice-connected-label ${voiceStatus === 'connecting' ? 'connecting' : ''}`}>
          {voiceStatus === 'connecting' ? 'Connecting...' : 'Voice Connected'}
        </div>
        <div className="voice-channel-label">
          {channelName} / {serverName}
        </div>
      </div>

      <div className="voice-controls-buttons">
        <button
          className={`voice-btn ${selfMuted ? 'active' : ''}`}
          onClick={toggleMute}
          title={selfMuted ? 'Unmute' : 'Mute'}
        >
          {selfMuted ? '\u{1F507}' : '\u{1F3A4}'}
        </button>

        <button
          className={`voice-btn ${selfDeafened ? 'active' : ''}`}
          onClick={toggleDeafen}
          title={selfDeafened ? 'Undeafen' : 'Deafen'}
        >
          {selfDeafened ? '\u{1F508}' : '\u{1F50A}'}
        </button>

        <button
          className="voice-btn"
          onClick={toggleCamera}
          title="Toggle Camera"
        >
          &#127909;
        </button>

        <button
          className="voice-btn disconnect"
          onClick={leaveVoice}
          title="Disconnect"
        >
          &#128222;
        </button>
      </div>
    </div>
  );
}
