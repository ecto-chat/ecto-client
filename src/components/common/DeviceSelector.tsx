import { useEffect, useState } from 'react';

export function DeviceSelector({
  kind,
  onClose,
  onSelect,
}: {
  kind: 'audioinput' | 'videoinput' | 'audiooutput';
  onClose: () => void;
  onSelect: (deviceId: string) => void;
}) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const storageKey = kind === 'audioinput' ? 'ecto-audio-device' : kind === 'audiooutput' ? 'ecto-audio-output' : 'ecto-video-device';
  const selectedId = localStorage.getItem(storageKey);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((all) => {
      setDevices(all.filter((d) => d.kind === kind));
    });
  }, [kind]);

  const handleSelect = (deviceId: string) => {
    localStorage.setItem(storageKey, deviceId);
    onSelect(deviceId);
    onClose();
  };

  const label = kind === 'audioinput' ? 'Audio Input' : kind === 'audiooutput' ? 'Audio Output' : 'Video Input';
  const fallbackLabel = kind === 'audioinput' ? 'Microphone' : kind === 'audiooutput' ? 'Speaker' : 'Camera';

  return (
    <div className="device-selector">
      <div className="device-selector-header">
        {label}
      </div>
      {devices.length === 0 ? (
        <div className="device-selector-empty">No devices found</div>
      ) : (
        devices.map((d) => {
          const isSelected = selectedId
            ? d.deviceId === selectedId
            : d.deviceId === 'default' || d.deviceId === '';

          return (
            <button
              key={d.deviceId}
              className={`device-selector-item ${isSelected ? 'selected' : ''}`}
              onClick={() => handleSelect(d.deviceId)}
            >
              {isSelected && <span className="device-check">&#10003;</span>}
              {d.label || `${fallbackLabel} ${d.deviceId.slice(0, 8)}`}
            </button>
          );
        })
      )}
    </div>
  );
}
