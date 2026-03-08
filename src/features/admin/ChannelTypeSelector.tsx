import { Hash, Volume2, FileText, Megaphone } from 'lucide-react';

import { cn } from '@/lib/cn';

export const CHANNEL_TYPES = [
  { value: 'text', label: 'Text', description: 'Messages & chat', icon: Hash },
  { value: 'voice', label: 'Voice', description: 'Real-time voice chat', icon: Volume2 },
  { value: 'page', label: 'Page', description: 'Persistent documents', icon: FileText },
  { value: 'news', label: 'News', description: 'Broadcast updates', icon: Megaphone },
] as const;

export type ChannelType = (typeof CHANNEL_TYPES)[number]['value'];

type ChannelTypeSelectorProps = {
  value: ChannelType;
  onChange: (type: ChannelType) => void;
};

export function ChannelTypeSelector({ value, onChange }: ChannelTypeSelectorProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {CHANNEL_TYPES.map((ct) => {
        const Icon = ct.icon;
        const selected = value === ct.value;
        return (
          <button
            key={ct.value}
            type="button"
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-lg p-3 text-center transition-colors',
              selected
                ? 'ring-2 ring-accent bg-accent/10'
                : 'bg-tertiary border-2 border-primary hover:border-accent/50',
            )}
            onClick={() => onChange(ct.value)}
          >
            <Icon size={20} className={selected ? 'text-accent' : 'text-secondary'} />
            <span className={cn('text-sm font-medium', selected ? 'text-accent' : 'text-primary')}>{ct.label}</span>
            <span className="text-xs text-muted leading-tight">{ct.description}</span>
          </button>
        );
      })}
    </div>
  );
}
