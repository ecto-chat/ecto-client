import { useEffect } from 'react';
import { useCallStore } from '@/stores/call';
import { useVoiceStore } from '@/stores/voice';
import { useUiStore } from '@/stores/ui';
import { useChannelStore } from '@/stores/channel';
import type { VoiceState } from 'ecto-shared';

type MediaWindowInfo = {
  mediaType: 'call' | 'voice' | null;
  isActive: boolean;
  peer: { display_name: string | null; username: string; avatar_url: string | null } | null;
  channelName: string | null;
  participants: VoiceState[];
  callStartedAt: number | null;
};

export function useMediaWindowMode(): MediaWindowInfo {
  const callState = useCallStore((s) => s.callState);
  const callPeer = useCallStore((s) => s.peer);
  const callStartedAt = useCallStore((s) => s.startedAt);
  const answeredElsewhere = useCallStore((s) => s.answeredElsewhere);

  const voiceChannelId = useVoiceStore((s) => s.currentChannelId);
  const voiceServerId = useVoiceStore((s) => s.currentServerId);
  const voiceStatus = useVoiceStore((s) => s.voiceStatus);
  const voiceParticipants = useVoiceStore((s) => s.participants);

  const channelName = useChannelStore((s) =>
    voiceServerId && voiceChannelId
      ? s.channels.get(voiceServerId)?.get(voiceChannelId)?.name ?? null
      : null,
  );

  const callIsActive =
    !answeredElsewhere &&
    (callState === 'active' || callState === 'connecting');

  const voiceIsActive = voiceChannelId !== null && voiceStatus !== 'disconnected';

  // Reset to fullscreen when both call and voice become inactive
  useEffect(() => {
    if (!callIsActive && !voiceIsActive) {
      const { mediaViewMode } = useUiStore.getState();
      if (mediaViewMode !== 'fullscreen') {
        useUiStore.getState().setMediaViewMode('fullscreen');
      }
    }
  }, [callIsActive, voiceIsActive]);

  if (callIsActive) {
    return {
      mediaType: 'call',
      isActive: true,
      peer: callPeer ? {
        display_name: callPeer.display_name,
        username: callPeer.username,
        avatar_url: callPeer.avatar_url,
      } : null,
      channelName: null,
      participants: [],
      callStartedAt,
    };
  }

  if (voiceIsActive) {
    const participants = [...voiceParticipants.values()].filter(
      (p) => p.channel_id === voiceChannelId,
    );
    return {
      mediaType: 'voice',
      isActive: true,
      peer: null,
      channelName,
      participants,
      callStartedAt: null,
    };
  }

  return {
    mediaType: null,
    isActive: false,
    peer: null,
    channelName: null,
    participants: [],
    callStartedAt: null,
  };
}
