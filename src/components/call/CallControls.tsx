import { useState, useEffect } from 'react';
import { useCall } from '../../hooks/useCall.js';
import { DeviceSelector } from '../common/DeviceSelector.js';
import { QualitySelector } from '../common/QualitySelector.js';

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
    switchAudioDevice,
    switchAudioOutput,
    switchVideoDevice,
  } = useCall();

  const [deviceMenu, setDeviceMenu] = useState<'audio' | 'output' | 'video' | 'video-quality' | 'screen-quality' | null>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!deviceMenu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.device-selector') && !target.closest('.voice-bar-device-btn')) {
        setDeviceMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [deviceMenu]);

  return (
    <div className="call-controls-bar">
      <div className="voice-bar-group">
        <button
          className={`voice-btn ${selfMuted ? 'active' : ''}`}
          onClick={toggleMute}
          title={selfMuted ? 'Unmute' : 'Mute'}
        >
          {selfMuted ? '\u{1F507}' : '\u{1F3A4}'}
        </button>
        <button
          className="voice-bar-device-btn"
          onClick={() => setDeviceMenu(deviceMenu === 'audio' ? null : 'audio')}
          title="Select audio input"
        >
          &#9650;
        </button>
        {deviceMenu === 'audio' && (
          <DeviceSelector kind="audioinput" onClose={() => setDeviceMenu(null)} onSelect={switchAudioDevice} />
        )}
      </div>

      <div className="voice-bar-group">
        <button
          className={`voice-btn ${selfDeafened ? 'active' : ''}`}
          onClick={toggleDeafen}
          title={selfDeafened ? 'Undeafen' : 'Deafen'}
        >
          {selfDeafened ? '\u{1F508}' : '\u{1F50A}'}
        </button>
        <button
          className="voice-bar-device-btn"
          onClick={() => setDeviceMenu(deviceMenu === 'output' ? null : 'output')}
          title="Select audio output"
        >
          &#9650;
        </button>
        {deviceMenu === 'output' && (
          <DeviceSelector kind="audiooutput" onClose={() => setDeviceMenu(null)} onSelect={switchAudioOutput} />
        )}
      </div>

      <div className="voice-bar-group">
        <button
          className={`voice-btn ${videoEnabled ? 'active' : ''}`}
          onClick={toggleVideo}
          title={videoEnabled ? 'Stop Camera' : 'Start Camera'}
        >
          {videoEnabled ? '\u{1F4F7}' : '\u{1F4F7}'}
        </button>
        <button
          className="voice-bar-device-btn"
          onClick={() => setDeviceMenu(deviceMenu === 'video' ? null : 'video')}
          title="Select camera"
        >
          &#9650;
        </button>
        <button
          className="voice-bar-device-btn"
          onClick={() => setDeviceMenu(deviceMenu === 'video-quality' ? null : 'video-quality')}
          title="Camera quality"
        >
          &#9881;
        </button>
        {deviceMenu === 'video' && (
          <DeviceSelector kind="videoinput" onClose={() => setDeviceMenu(null)} onSelect={switchVideoDevice} />
        )}
        {deviceMenu === 'video-quality' && (
          <QualitySelector kind="video" onClose={() => setDeviceMenu(null)} />
        )}
      </div>

      <div className="voice-bar-group">
        <button
          className={`voice-btn ${screenSharing ? 'active' : ''}`}
          onClick={toggleScreenShare}
          title={screenSharing ? 'Stop Sharing' : 'Share Screen'}
        >
          {screenSharing ? '\u{1F5B5}' : '\u{1F5B5}'}
        </button>
        <button
          className="voice-bar-device-btn"
          onClick={() => setDeviceMenu(deviceMenu === 'screen-quality' ? null : 'screen-quality')}
          title="Screen share quality"
        >
          &#9881;
        </button>
        {deviceMenu === 'screen-quality' && (
          <QualitySelector kind="screen" onClose={() => setDeviceMenu(null)} />
        )}
      </div>

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
