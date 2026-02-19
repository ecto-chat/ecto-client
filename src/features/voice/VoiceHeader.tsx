import { Volume2, Users, Minimize2 } from 'lucide-react';

import { IconButton } from '@/ui';
import { useUiStore } from '@/stores/ui';
import { useVoiceStore } from '@/stores/voice';
import { cn } from '@/lib/cn';

type VoiceHeaderProps = {
  channelName: string;
  participantCount: number;
};

export function VoiceHeader({ channelName, participantCount }: VoiceHeaderProps) {
  const activeChannelId = useUiStore((s) => s.activeChannelId);
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const voiceStatus = useVoiceStore((s) => s.voiceStatus);
  const isConnectedHere = currentChannelId === activeChannelId && voiceStatus !== 'disconnected';

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
        {isConnectedHere && (
          <IconButton
            size="sm"
            variant="ghost"
            tooltip="Minimize"
            onClick={() => useUiStore.getState().setMediaViewMode('floating')}
          >
            <Minimize2 className="size-3.5" />
          </IconButton>
        )}
      </div>
    </div>
  );
}
