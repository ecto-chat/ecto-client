import { useCallback, useEffect, useState } from 'react';

import { motion } from 'motion/react';
import { MicOff, Minimize2, Pin } from 'lucide-react';

import { Avatar, IconButton } from '@/ui';

import { useCall } from '@/hooks/useCall';
import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/lib/cn';
import { playOutgoingRingback } from '@/lib/ringtone';
import type { GridSlot } from '@/lib/grid-layout';
import type { VoiceState } from 'ecto-shared';

import { VideoRenderer } from '../voice/VideoRenderer';
import { ParticipantGridLayout, type ParticipantSlot } from '../voice/ParticipantGridLayout';
import { CallControls } from './CallControls';

/** Stub VoiceState for call participants (calls don't have server-level mute/deaf). */
function makeCallVoiceState(userId: string, selfMute: boolean, selfDeaf: boolean): VoiceState {
  return {
    user_id: userId,
    channel_id: '',
    self_mute: selfMute,
    self_deaf: selfDeaf,
    server_mute: false,
    server_deaf: false,
    video_enabled: false,
    connected_at: new Date().toISOString(),
  };
}

export function ActiveCallOverlay() {
  const {
    callState, peer, startedAt, endReason, peerMuted, peerDeafened,
    selfMuted, selfDeafened,
    localVideoStream, localScreenStream,
    remoteVideoStream, remoteScreenStream,
    localSpeaking, remoteSpeaking, answeredElsewhere,
  } = useCall();

  const currentUser = useAuthStore((s) => s.user);
  const [elapsed, setElapsed] = useState(0);
  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (callState !== 'outgoing_ringing') return;
    const ringback = playOutgoingRingback();
    return () => ringback.stop();
  }, [callState]);

  useEffect(() => {
    if (callState !== 'active' || !startedAt) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [callState, startedAt]);

  const handlePinToggle = useCallback((slotId: string) => {
    setPinnedUserId((prev) => (prev === slotId ? null : slotId));
  }, []);

  const mediaViewMode = useUiStore((s) => s.mediaViewMode);

  if (answeredElsewhere) return null;

  const isVisible =
    callState === 'outgoing_ringing' || callState === 'connecting' ||
    callState === 'active' || callState === 'ended';

  if (!isVisible || !peer) return null;

  // When in floating/snapped mode and actively in call, hide the fullscreen overlay
  if (mediaViewMode !== 'fullscreen' && callState === 'active') return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const statusLabel = (() => {
    switch (callState) {
      case 'outgoing_ringing': return 'Calling...';
      case 'connecting': return 'Connecting...';
      case 'ended': {
        switch (endReason) {
          case 'rejected': return 'Call Declined';
          case 'timeout': return 'No Answer';
          case 'busy': return 'User Busy';
          case 'unavailable': return 'User Unavailable';
          case 'disconnected': return 'Call Disconnected';
          default: return 'Call Ended';
        }
      }
      default: return '';
    }
  })();

  // Build participant grid for active calls
  const renderActiveCall = () => {
    if (!currentUser) return null;

    const localUserId = currentUser.id;
    const remoteUserId = peer.user_id;

    const participants: ParticipantSlot[] = [];

    // Local participant
    participants.push({
      id: localUserId,
      participant: makeCallVoiceState(localUserId, selfMuted, selfDeafened),
      displayName: currentUser.display_name ?? currentUser.username,
      avatarUrl: currentUser.avatar_url ?? null,
      isSpeaking: localSpeaking,
      videoStream: localVideoStream ?? undefined,
      screenStream: localScreenStream ?? undefined,
    });

    // Remote participant
    participants.push({
      id: remoteUserId,
      participant: makeCallVoiceState(remoteUserId, peerMuted, peerDeafened),
      displayName: peer.display_name ?? peer.username,
      avatarUrl: peer.avatar_url,
      isSpeaking: remoteSpeaking,
      videoStream: remoteVideoStream ?? undefined,
      screenStream: remoteScreenStream ?? undefined,
    });

    const renderParticipant = (slot: GridSlot, participant: ParticipantSlot) => {
      const isScreen = slot.id.endsWith(':screen');

      return (
        <div
          key={slot.id}
          role="button"
          tabIndex={0}
          onClick={() => handlePinToggle(slot.id)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePinToggle(slot.id); } }}
          className={cn(
            'group relative h-full w-full rounded-xl overflow-hidden cursor-pointer',
            slot.isSpotlight ? 'bg-secondary' : 'bg-secondary',
            participant.isSpeaking && !slot.isSpotlight && 'ring-2 ring-status-online',
          )}
        >
          {participant.videoStream ? (
            <VideoRenderer stream={participant.videoStream} className={cn('h-full w-full', isScreen ? 'object-contain' : 'object-cover')} />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <div className={cn('relative', participant.isSpeaking && 'ring-2 ring-status-online rounded-full')}>
                <Avatar
                  src={participant.avatarUrl}
                  username={participant.displayName}
                  size={slot.isSpotlight ? 120 : 48}
                />
                {participant.participant.self_mute && (
                  <MicOff className="absolute -bottom-1 -right-1 size-4 text-danger" />
                )}
              </div>
            </div>
          )}

          {/* Pin indicator */}
          {pinnedUserId === slot.id && (
            <div className="absolute top-2 right-2 rounded-md bg-black/60 p-1.5">
              <Pin size={14} className="text-white" />
            </div>
          )}

          {/* Name overlay */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1">
            <span className="text-xs font-medium text-white truncate max-w-[120px]">
              {participant.displayName}
              {isScreen && "'s screen"}
            </span>
            {participant.participant.self_mute && <MicOff size={12} className="shrink-0 text-white/70" />}
          </div>
        </div>
      );
    };

    return (
      <ParticipantGridLayout
        participants={participants}
        pinnedUserId={pinnedUserId}
        renderParticipant={renderParticipant}
      />
    );
  };

  // Non-active states: avatar-centered layout
  const renderNonActiveContent = () => {
    const speakingRing = 'ring-2 ring-status-online';

    return (
      <div className="relative flex flex-1 items-center justify-center w-full p-6">
        <div className={cn('relative flex items-center justify-center', remoteSpeaking && speakingRing, 'rounded-full')}>
          <Avatar src={peer.avatar_url} username={peer.username} size={120} />
          {peerMuted && <MicOff className="absolute -bottom-1 -right-1 size-5 text-danger" />}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="fixed inset-0 z-[300] flex flex-col items-center justify-between bg-[rgba(12,12,20,0.95)] backdrop-blur-sm"
    >
      {/* Minimize button */}
      {callState === 'active' && (
        <div className="absolute top-4 right-4 z-10">
          <IconButton
            tooltip="Minimize"
            onClick={() => useUiStore.getState().setMediaViewMode('floating')}
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            <Minimize2 className="size-[18px]" />
          </IconButton>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col items-center gap-1 pt-10 shrink-0">
        <span className="text-lg font-medium text-primary">{peer.display_name ?? peer.username}</span>
        {callState === 'active' && <span className="text-sm text-muted">{formatTime(elapsed)}</span>}
        {statusLabel && <span className="text-sm text-secondary">{statusLabel}</span>}
      </div>

      {/* Main content */}
      {callState === 'active' ? (
        <div className="flex-1 min-h-0 w-full">
          {renderActiveCall()}
        </div>
      ) : (
        renderNonActiveContent()
      )}

      {callState !== 'ended' && <CallControls />}
    </motion.div>
  );
}
