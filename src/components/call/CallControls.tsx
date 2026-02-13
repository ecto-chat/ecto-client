import { useCall } from '../../hooks/useCall.js';

export function CallControls() {
  const {
    selfMuted,
    selfDeafened,
    videoEnabled,
    screenSharing,
    toggleMute,
    toggleDeafen,
    toggleVideo,
    toggleScreenShare,
    endCall,
  } = useCall();

  return (
    <div className="call-controls-bar">
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
        className={`voice-btn ${videoEnabled ? 'active' : ''}`}
        onClick={toggleVideo}
        title={videoEnabled ? 'Stop Camera' : 'Start Camera'}
      >
        {videoEnabled ? '\u{1F4F7}' : '\u{1F4F7}'}
      </button>

      <button
        className={`voice-btn ${screenSharing ? 'active' : ''}`}
        onClick={toggleScreenShare}
        title={screenSharing ? 'Stop Sharing' : 'Share Screen'}
      >
        {screenSharing ? '\u{1F5B5}' : '\u{1F5B5}'}
      </button>

      <button
        className="voice-btn disconnect"
        onClick={endCall}
        title="End Call"
      >
        &#128222;
      </button>
    </div>
  );
}
