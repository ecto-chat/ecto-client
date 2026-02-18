import { useEffect, useState } from 'react';

import { Check } from 'lucide-react';

import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/ui';

type DeviceSelectorProps = {
  kind: 'audioinput' | 'videoinput' | 'audiooutput';
  onSelect: (deviceId: string) => void;
};

const LABELS: Record<DeviceSelectorProps['kind'], { heading: string; fallback: string }> = {
  audioinput: { heading: 'Audio Input', fallback: 'Microphone' },
  audiooutput: { heading: 'Audio Output', fallback: 'Speaker' },
  videoinput: { heading: 'Video Input', fallback: 'Camera' },
};

const STORAGE_KEYS: Record<DeviceSelectorProps['kind'], string> = {
  audioinput: 'ecto-audio-device',
  audiooutput: 'ecto-audio-output',
  videoinput: 'ecto-video-device',
};

export function DeviceSelector({ kind, onSelect }: DeviceSelectorProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const storageKey = STORAGE_KEYS[kind];
  const selectedId = localStorage.getItem(storageKey);
  const { heading, fallback } = LABELS[kind];

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((all) => {
      setDevices(all.filter((d) => d.kind === kind));
    });
  }, [kind]);

  const handleSelect = (deviceId: string) => {
    localStorage.setItem(storageKey, deviceId);
    onSelect(deviceId);
  };

  return (
    <DropdownMenuContent side="top" align="center" sideOffset={8}>
      <DropdownMenuLabel>{heading}</DropdownMenuLabel>
      {devices.length === 0 ? (
        <div className="px-2 py-1.5 text-sm text-muted">No devices found</div>
      ) : (
        devices.map((d) => {
          const isSelected = selectedId
            ? d.deviceId === selectedId
            : d.deviceId === 'default' || d.deviceId === '';

          return (
            <DropdownMenuItem
              key={d.deviceId}
              onSelect={() => handleSelect(d.deviceId)}
              className="gap-2"
            >
              {isSelected && <Check className="size-3.5 shrink-0 text-accent" />}
              <span className={isSelected ? '' : 'pl-5.5'}>
                {d.label || `${fallback} ${d.deviceId.slice(0, 8)}`}
              </span>
            </DropdownMenuItem>
          );
        })
      )}
    </DropdownMenuContent>
  );
}
