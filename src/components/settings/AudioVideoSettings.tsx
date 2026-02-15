import { useState, useEffect, useCallback } from 'react';
import { useVoiceStore } from '../../stores/voice.js';

const AUDIO_INPUT_KEY = 'ecto-audio-device';
const AUDIO_OUTPUT_KEY = 'ecto-audio-output';
const VIDEO_INPUT_KEY = 'ecto-video-device';
const VIDEO_QUALITY_KEY = 'ecto-video-quality';
const SCREEN_QUALITY_KEY = 'ecto-screen-quality';

const QUALITY_OPTIONS = [
  { value: 'low', label: 'Low (360p)' },
  { value: 'medium', label: 'Medium (720p)' },
  { value: 'high', label: 'High (1080p)' },
  { value: 'source', label: 'Source (1080p60)' },
];

const SCREEN_QUALITY_OPTIONS = [
  { value: 'low', label: 'Low (720p)' },
  { value: 'medium', label: 'Medium (1080p)' },
  { value: 'high', label: 'High (1080p60)' },
  { value: 'source', label: 'Source (1080p60)' },
];

export function AudioVideoSettings() {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);

  const [selectedAudioInput, setSelectedAudioInput] = useState(
    () => localStorage.getItem(AUDIO_INPUT_KEY) ?? '',
  );
  const [selectedAudioOutput, setSelectedAudioOutput] = useState(
    () => localStorage.getItem(AUDIO_OUTPUT_KEY) ?? '',
  );
  const [selectedVideoInput, setSelectedVideoInput] = useState(
    () => localStorage.getItem(VIDEO_INPUT_KEY) ?? '',
  );
  const [videoQuality, setVideoQuality] = useState(
    () => localStorage.getItem(VIDEO_QUALITY_KEY) ?? 'medium',
  );
  const [screenQuality, setScreenQuality] = useState(
    () => localStorage.getItem(SCREEN_QUALITY_KEY) ?? 'high',
  );

  const enumerateDevices = useCallback(async () => {
    try {
      // Request permission first to get labeled devices
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
      }).catch(() => {});

      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter((d) => d.kind === 'audioinput'));
      setAudioOutputs(devices.filter((d) => d.kind === 'audiooutput'));
      setVideoInputs(devices.filter((d) => d.kind === 'videoinput'));
    } catch {
      // Device enumeration not available
    }
  }, []);

  useEffect(() => {
    enumerateDevices();
  }, [enumerateDevices]);

  const handleAudioInputChange = (deviceId: string) => {
    setSelectedAudioInput(deviceId);
    localStorage.setItem(AUDIO_INPUT_KEY, deviceId);
  };

  const handleAudioOutputChange = (deviceId: string) => {
    setSelectedAudioOutput(deviceId);
    localStorage.setItem(AUDIO_OUTPUT_KEY, deviceId);
  };

  const handleVideoInputChange = (deviceId: string) => {
    setSelectedVideoInput(deviceId);
    localStorage.setItem(VIDEO_INPUT_KEY, deviceId);
  };

  const handleVideoQualityChange = (quality: string) => {
    setVideoQuality(quality);
    localStorage.setItem(VIDEO_QUALITY_KEY, quality);
  };

  const handleScreenQualityChange = (quality: string) => {
    setScreenQuality(quality);
    localStorage.setItem(SCREEN_QUALITY_KEY, quality);
  };

  return (
    <div className="settings-section">
      <h2 className="settings-heading">Voice & Video</h2>

      <div className="av-settings-group">
        <div className="av-device-row">
          <label className="av-device-label">Audio Input</label>
          <select
            className="av-device-select"
            value={selectedAudioInput}
            onChange={(e) => handleAudioInputChange(e.target.value)}
          >
            <option value="">Default</option>
            {audioInputs.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>

        <div className="av-device-row">
          <label className="av-device-label">Audio Output</label>
          <select
            className="av-device-select"
            value={selectedAudioOutput}
            onChange={(e) => handleAudioOutputChange(e.target.value)}
          >
            <option value="">Default</option>
            {audioOutputs.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Speaker ${device.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>

        <div className="av-device-row">
          <label className="av-device-label">Camera</label>
          <select
            className="av-device-select"
            value={selectedVideoInput}
            onChange={(e) => handleVideoInputChange(e.target.value)}
          >
            <option value="">Default</option>
            {videoInputs.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>

        <div className="av-quality-row">
          <div className="av-quality-item">
            <label className="av-device-label">Camera Quality</label>
            <select
              className="av-device-select"
              value={videoQuality}
              onChange={(e) => handleVideoQualityChange(e.target.value)}
            >
              {QUALITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="av-quality-item">
            <label className="av-device-label">Screen Share Quality</label>
            <select
              className="av-device-select"
              value={screenQuality}
              onChange={(e) => handleScreenQualityChange(e.target.value)}
            >
              {SCREEN_QUALITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <p className="settings-hint">
          Device changes take effect next time you join a voice channel or start a call.
        </p>
      </div>

      <PushToTalkSettings />
    </div>
  );
}

function PushToTalkSettings() {
  const pttEnabled = useVoiceStore((s) => s.pttEnabled);
  const pttKey = useVoiceStore((s) => s.pttKey);
  const setPttEnabled = useVoiceStore((s) => s.setPttEnabled);
  const setPttKey = useVoiceStore((s) => s.setPttKey);
  const [recording, setRecording] = useState(false);

  const pttKeyLabel = pttKey === ' ' ? 'Space' : pttKey;

  const handleRecordKey = useCallback(() => {
    setRecording(true);
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      setPttKey(e.key);
      setRecording(false);
      window.removeEventListener('keydown', handler);
    };
    window.addEventListener('keydown', handler);
  }, [setPttKey]);

  return (
    <div className="settings-section" style={{ marginTop: 24 }}>
      <h2 className="settings-heading">Input Mode</h2>
      <div className="notification-toggles">
        <label className="notification-toggle-row">
          <div className="notification-toggle-info">
            <span className="notification-toggle-label">Push to Talk</span>
            <span className="notification-toggle-desc">
              Hold a key to transmit audio instead of always-on voice activity
            </span>
          </div>
          <input
            type="checkbox"
            checked={pttEnabled}
            onChange={(e) => setPttEnabled(e.target.checked)}
            className="notification-toggle-checkbox"
          />
        </label>
      </div>

      {pttEnabled && (
        <div className="settings-group" style={{ marginTop: 12 }}>
          <div className="av-device-row">
            <label className="av-device-label">Push to Talk Key</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="settings-input" style={{ flex: 1, textAlign: 'center' }}>
                {recording ? 'Press a key...' : pttKeyLabel}
              </span>
              <button className="btn-secondary" onClick={handleRecordKey} disabled={recording}>
                {recording ? 'Listening...' : 'Change Key'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
