import { Check } from 'lucide-react';

import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/ui';

import {
  QUALITY_OPTIONS,
  SCREEN_QUALITY_OPTIONS,
  getVideoQuality,
  getScreenQuality,
  setVideoQuality,
  setScreenQuality,
  type VideoQuality,
  type ScreenQuality,
} from '@/lib/media-presets';

type QualitySelectorProps = {
  kind: 'video' | 'screen';
};

export function QualitySelector({ kind }: QualitySelectorProps) {
  const options = kind === 'video' ? QUALITY_OPTIONS : SCREEN_QUALITY_OPTIONS;
  const selectedValue = kind === 'video' ? getVideoQuality() : getScreenQuality();

  const handleSelect = (value: string) => {
    if (kind === 'video') setVideoQuality(value as VideoQuality);
    else setScreenQuality(value as ScreenQuality);
  };

  return (
    <DropdownMenuContent side="top" align="center" sideOffset={8}>
      <DropdownMenuLabel>
        {kind === 'video' ? 'Camera Quality' : 'Screen Share Quality'}
      </DropdownMenuLabel>
      {options.map((opt) => {
        const isSelected = selectedValue === opt.value;
        return (
          <DropdownMenuItem
            key={opt.value}
            onSelect={() => handleSelect(opt.value)}
            className="gap-2"
          >
            {isSelected && <Check className="size-3.5 shrink-0 text-accent" />}
            <span className={isSelected ? '' : 'pl-5.5'}>
              {opt.label}
            </span>
          </DropdownMenuItem>
        );
      })}
    </DropdownMenuContent>
  );
}
