import { useState, useEffect, useCallback } from 'react';

import { Select } from '@/ui';

import { preferenceManager } from '@/services/preference-manager';

import { PushToTalkSettings } from './PushToTalkSettings';

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

function toOptions(devices: MediaDeviceInfo[], fallbackPrefix: string) {
  return [
    { value: '', label: 'Default' },
    ...devices.map((d) => ({ value: d.deviceId, label: d.label || `${fallbackPrefix} ${d.deviceId.slice(0, 8)}` })),
  ];
}

export function AudioVideoSettings() {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);

  const [selectedAudioInput, setSelectedAudioInput] = useState(() => preferenceManager.getDevice('audio-input', ''));
  const [selectedAudioOutput, setSelectedAudioOutput] = useState(() => preferenceManager.getDevice('audio-output', ''));
  const [selectedVideoInput, setSelectedVideoInput] = useState(() => preferenceManager.getDevice('video-input', ''));
  const [videoQuality, setVideoQuality] = useState(() => preferenceManager.getDevice('video-quality', 'medium'));
  const [screenQuality, setScreenQuality] = useState(() => preferenceManager.getDevice('screen-quality', 'high'));

  const enumerateDevices = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
      }).catch(() => {});
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter((d) => d.kind === 'audioinput'));
      setAudioOutputs(devices.filter((d) => d.kind === 'audiooutput'));
      setVideoInputs(devices.filter((d) => d.kind === 'videoinput'));
    } catch { /* Device enumeration not available */ }
  }, []);

  useEffect(() => { enumerateDevices(); }, [enumerateDevices]);

  const persist = (key: string, value: string, setter: (v: string) => void) => {
    setter(value);
    preferenceManager.setDevice(key, value);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-primary">Voice & Video</h2>

      <div className="space-y-4">
        <Select label="Audio Input" options={toOptions(audioInputs, 'Microphone')} value={selectedAudioInput} onValueChange={(v) => persist('audio-input', v, setSelectedAudioInput)} />
        <Select label="Audio Output" options={toOptions(audioOutputs, 'Speaker')} value={selectedAudioOutput} onValueChange={(v) => persist('audio-output', v, setSelectedAudioOutput)} />
        <Select label="Camera" options={toOptions(videoInputs, 'Camera')} value={selectedVideoInput} onValueChange={(v) => persist('video-input', v, setSelectedVideoInput)} />

        <div className="grid grid-cols-2 gap-4">
          <Select label="Camera Quality" options={QUALITY_OPTIONS} value={videoQuality} onValueChange={(v) => persist('video-quality', v, setVideoQuality)} />
          <Select label="Screen Share Quality" options={SCREEN_QUALITY_OPTIONS} value={screenQuality} onValueChange={(v) => persist('screen-quality', v, setScreenQuality)} />
        </div>

        <p className="text-xs text-muted">
          Device changes take effect next time you join a voice channel or start a call.
        </p>
      </div>

      <PushToTalkSettings />
    </div>
  );
}
