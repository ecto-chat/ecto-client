import { useVoiceStore } from '@/stores/voice';
import { useUiStore } from '@/stores/ui';
import { useChannelStore } from '@/stores/channel';

import { VoiceHeader } from './VoiceHeader';
import { VoiceParticipantGrid } from './VoiceParticipantGrid';
import { VoiceToolbar } from './VoiceToolbar';

export function VoiceView() {
  const activeServerId = useUiStore((s) => s.activeServerId);
  const activeChannelId = useUiStore((s) => s.activeChannelId);

  const channel = useChannelStore((s) =>
    activeServerId ? s.channels.get(activeServerId)?.get(activeChannelId ?? '') : undefined,
  );

  const participants = useVoiceStore((s) => s.participants);
  const voiceStatus = useVoiceStore((s) => s.voiceStatus);
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);

  const channelParticipants = [...participants.values()].filter(
    (p) => p.channel_id === activeChannelId,
  );

  const isConnectedHere =
    currentChannelId === activeChannelId && voiceStatus !== 'disconnected';

  if (!activeServerId || !activeChannelId) return null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <VoiceHeader
        channelName={channel?.name ?? 'Voice Channel'}
        participantCount={channelParticipants.length}
      />

      <VoiceParticipantGrid
        participants={channelParticipants}
        serverId={activeServerId}
      />

      <VoiceToolbar
        serverId={activeServerId}
        channelId={activeChannelId}
        isConnectedHere={isConnectedHere}
      />
    </div>
  );
}
