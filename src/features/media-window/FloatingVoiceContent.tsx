import type { VoiceState } from 'ecto-shared';

import { cn } from '@/lib/cn';
import { Avatar } from '@/ui';
import { useVoiceStore } from '@/stores/voice';
import { useMemberStore } from '@/stores/member';
import { VideoRenderer } from '@/features/shared/VideoRenderer';

type FloatingVoiceContentProps = {
  participants: VoiceState[];
};

export function FloatingVoiceContent({ participants }: FloatingVoiceContentProps) {
  const speaking = useVoiceStore((s) => s.speaking);
  const voiceServerId = useVoiceStore((s) => s.currentServerId);
  const videoStreams = useVoiceStore((s) => s.videoStreams);
  const screenStreams = useVoiceStore((s) => s.screenStreams);
  const members = useMemberStore((s) =>
    voiceServerId ? s.members.get(voiceServerId) : undefined,
  );

  // Find the first active screen share or video stream
  const screenEntry = [...screenStreams.entries()].find(([uid]) =>
    participants.some((p) => p.user_id === uid),
  );
  const videoEntry = !screenEntry
    ? [...videoStreams.entries()].find(([uid]) =>
        participants.some((p) => p.user_id === uid),
      )
    : null;

  const activeStream = screenEntry?.[1] ?? videoEntry?.[1] ?? null;
  const activeUserId = screenEntry?.[0] ?? videoEntry?.[0] ?? null;

  // If there's an active stream, show it full-bleed
  if (activeStream && activeUserId) {
    const member = members?.get(activeUserId);
    const name = member?.display_name ?? member?.username ?? 'Unknown';
    const isSpeaking = speaking.has(activeUserId);

    return (
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <VideoRenderer
          stream={activeStream}
          className={cn(
            'h-full w-full object-cover',
            isSpeaking && !screenEntry && 'ring-2 ring-status-online',
          )}
        />
        <span className="absolute bottom-1 left-2 text-[10px] font-medium text-white/80 bg-black/40 px-1.5 py-0.5 rounded">
          {name}{screenEntry ? ' (screen)' : ''}
        </span>
        {participants.length > 1 && (
          <span className="absolute bottom-1 right-2 text-[10px] font-medium text-white/70 bg-black/40 px-1.5 py-0.5 rounded">
            {participants.length} participants
          </span>
        )}
      </div>
    );
  }

  // Fallback: avatar grid
  const shown = participants.slice(0, 4);
  const extra = participants.length - 4;

  return (
    <div className="relative flex flex-1 items-center justify-center p-3">
      <div className="grid grid-cols-2 gap-2">
        {shown.map((p) => {
          const member = members?.get(p.user_id);
          const name = member?.display_name ?? member?.username ?? 'Unknown';
          const isSpeaking = speaking.has(p.user_id);
          return (
            <div
              key={p.user_id}
              className="flex flex-col items-center gap-1"
            >
              <div
                className={cn(
                  'rounded-full',
                  isSpeaking && 'ring-2 ring-status-online',
                )}
              >
                <Avatar
                  src={member?.avatar_url}
                  username={name}
                  size={40}
                />
              </div>
              <span className="text-[10px] text-white/70 truncate max-w-[60px]">
                {name}
              </span>
            </div>
          );
        })}
      </div>
      {extra > 0 && (
        <span className="absolute bottom-1 right-2 text-[10px] font-medium text-white/70 bg-black/40 px-1.5 py-0.5 rounded">
          +{extra}
        </span>
      )}
    </div>
  );
}
