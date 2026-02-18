import { useCallback } from 'react';

import { AnimatePresence } from 'motion/react';
import { Headphones } from 'lucide-react';
import type { VoiceState } from 'ecto-shared';

import { EmptyState, ScrollArea } from '@/ui';

import { useVoiceStore } from '@/stores/voice';
import { useMemberStore } from '@/stores/member';

import { connectionManager } from '@/services/connection-manager';

import { useModPermissions } from './useModPermissions';
import { VoiceParticipant } from './VoiceParticipant';

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

  return (
    <ScrollArea className="flex-1">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 p-4">
        <AnimatePresence mode="popLayout">
          {participants.map((p, i) => {
            const member = members?.get(p.user_id);
            const displayName = member?.display_name ?? member?.username ?? 'Unknown';

            return (
              <VoiceParticipant
                key={p.user_id}
                participant={p}
                displayName={displayName}
                avatarUrl={member?.avatar_url}
                isSpeaking={speaking.has(p.user_id)}
                videoStream={videoStreams.get(p.user_id)}
                screenStream={screenStreams.get(p.user_id)}
                serverId={serverId}
                myUserId={myUserId}
                canMute={canMute}
                canDeafen={canDeafen}
                onServerMute={handleServerMute}
                onServerDeafen={handleServerDeafen}
                index={i}
              />
            );
          })}
        </AnimatePresence>
      </div>
    </ScrollArea>
  );
}
