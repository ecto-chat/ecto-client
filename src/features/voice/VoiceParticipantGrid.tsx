import { useCallback, useEffect, useState } from 'react';

import { Headphones } from 'lucide-react';
import type { VoiceState } from 'ecto-shared';

import { EmptyState } from '@/ui';

import { useVoiceStore } from '@/stores/voice';
import { useMemberStore } from '@/stores/member';

import { connectionManager } from '@/services/connection-manager';

import { useModPermissions } from './useModPermissions';
import { VoiceParticipant } from './VoiceParticipant';
import { ParticipantGridLayout, type ParticipantSlot } from './ParticipantGridLayout';
import type { GridSlot } from '@/lib/grid-layout';

type VoiceParticipantGridProps = {
  participants: VoiceState[];
  serverId: string;
};

export function VoiceParticipantGrid({ participants, serverId }: VoiceParticipantGridProps) {
  const speaking = useVoiceStore((s) => s.speaking);
  const videoStreams = useVoiceStore((s) => s.videoStreams);
  const screenStreams = useVoiceStore((s) => s.screenStreams);
  const members = useMemberStore((s) => s.members.get(serverId));
  const { canMute, canDeafen, myUserId } = useModPermissions(serverId);

  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null);

  // Clear pin when pinned user leaves (strip :screen suffix to check user presence)
  useEffect(() => {
    if (!pinnedUserId) return;
    const baseUserId = pinnedUserId.replace(':screen', '');
    const userPresent = participants.some((p) => p.user_id === baseUserId);
    if (!userPresent) {
      setPinnedUserId(null);
      return;
    }
    // If pinned to a screen share, clear pin when that user stops sharing
    if (pinnedUserId.endsWith(':screen')) {
      const hasScreen = screenStreams.has(baseUserId);
      if (!hasScreen) setPinnedUserId(null);
    }
  }, [participants, pinnedUserId, screenStreams]);

  const handlePinToggle = useCallback((slotId: string) => {
    setPinnedUserId((prev) => (prev === slotId ? null : slotId));
  }, []);

  const handleServerMute = useCallback(
    (userId: string, currentlyMuted: boolean) => {
      const ws = connectionManager.getMainWs(serverId);
      ws?.voiceServerMute(userId, !currentlyMuted);
    },
    [serverId],
  );

  const handleServerDeafen = useCallback(
    (userId: string, currentlyDeafened: boolean) => {
      const ws = connectionManager.getMainWs(serverId);
      ws?.voiceServerDeafen(userId, !currentlyDeafened);
    },
    [serverId],
  );

  if (participants.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={<Headphones />}
          title="No one here yet"
          description="Join the voice channel to start talking"
        />
      </div>
    );
  }

  // Build participant slots
  const slots: ParticipantSlot[] = participants.map((p) => {
    const member = members?.get(p.user_id);
    const displayName = member?.display_name ?? member?.username ?? 'Unknown';
    return {
      id: p.user_id,
      participant: p,
      displayName,
      avatarUrl: member?.avatar_url,
      isSpeaking: speaking.has(p.user_id),
      videoStream: videoStreams.get(p.user_id),
      screenStream: screenStreams.get(p.user_id),
    };
  });

  const renderParticipant = (slot: GridSlot, participant: ParticipantSlot) => {
    // For screen share slots, we render as a video-only participant
    const isScreenSlot = slot.id.endsWith(':screen');
    const realUserId = isScreenSlot ? slot.id.replace(':screen', '') : slot.id;
    const realParticipant = isScreenSlot
      ? participants.find((p) => p.user_id === realUserId)
      : participant.participant;

    if (!realParticipant) return null;

    // Determine variant based on layout position
    const resolvedVariant = slot.isSpotlight ? 'spotlight' as const : (
      // In spotlight tier, non-spotlight slots are thumbnails
      slots.length >= 5 || pinnedUserId ? 'thumbnail' as const : 'default' as const
    );

    return (
      <VoiceParticipant
        key={slot.id}
        participant={realParticipant}
        displayName={participant.displayName}
        avatarUrl={participant.avatarUrl}
        isSpeaking={participant.isSpeaking}
        videoStream={participant.videoStream}
        serverId={serverId}
        myUserId={myUserId}
        canMute={canMute}
        canDeafen={canDeafen}
        onServerMute={handleServerMute}
        onServerDeafen={handleServerDeafen}
        onPinToggle={handlePinToggle}
        isPinned={pinnedUserId === slot.id}
        slotId={slot.id}
        variant={resolvedVariant}
      />
    );
  };

  return (
    <div className="flex-1 min-h-0">
      <ParticipantGridLayout
        participants={slots}
        pinnedUserId={pinnedUserId}
        renderParticipant={renderParticipant}
      />
    </div>
  );
}
