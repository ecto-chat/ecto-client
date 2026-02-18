import { Volume2, Users } from 'lucide-react';

import { cn } from '@/lib/cn';

type VoiceHeaderProps = {
  channelName: string;
  participantCount: number;
};

export function VoiceHeader({ channelName, participantCount }: VoiceHeaderProps) {
  return (
    <div
      className={cn(
        'flex h-12 shrink-0 items-center gap-2 border-b border-border px-4',
      )}
    >
      <Volume2 size={18} className="shrink-0 text-muted" />
      <span className="text-sm font-medium text-primary">{channelName}</span>
      <div className="ml-auto flex items-center gap-1.5 text-xs text-muted">
        <Users size={14} />
        <span>{participantCount}</span>
      </div>
    </div>
  );
}
