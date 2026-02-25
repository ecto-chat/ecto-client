import { useCallback, type MouseEvent } from 'react';

import { MicOff, VolumeX, ShieldAlert, Monitor, Pin } from 'lucide-react';
import { motion } from 'motion/react';
import type { VoiceState } from 'ecto-shared';

import { Avatar, IconButton, Tooltip } from '@/ui';

import { useUiStore } from '@/stores/ui';
import { useVoiceStore } from '@/stores/voice';

import { cn } from '@/lib/cn';

import { VideoRenderer } from './VideoRenderer';
import { VoiceStatsOverlay } from './VoiceStatsOverlay';
import { ScreenAudioControl, UserVolumeControl } from './VoiceVolumeControl';

type VoiceParticipantProps = {
  participant: VoiceState;
  displayName: string;
  avatarUrl?: string | null;
  isSpeaking: boolean;
  videoStream?: MediaStream;
  screenStream?: MediaStream;
  serverId: string;
  myUserId: string | null;
  canMute: boolean;
  canDeafen: boolean;
  onServerMute: (userId: string, currentlyMuted: boolean) => void;
  onServerDeafen: (userId: string, currentlyDeafened: boolean) => void;
  onPinToggle?: (slotId: string) => void;
  isPinned?: boolean;
  /** Slot identifier used for pinning — defaults to participant user_id. Use `userId:screen` for screen share slots. */
  slotId?: string;
  variant?: 'default' | 'spotlight' | 'thumbnail';
  index: number;
};

export function VoiceParticipant({
  participant: p,
  displayName,
  avatarUrl,
  isSpeaking,
  videoStream,
  screenStream,
  serverId,
  myUserId,
  canMute,
  canDeafen,
  onServerMute,
  onServerDeafen,
  onPinToggle,
  isPinned = false,
  slotId,
  variant = 'default',
  index,
}: VoiceParticipantProps) {
  const audioLevel = useVoiceStore((s) => s.audioLevels.get(p.user_id) ?? 0);
  const resolvedSlotId = slotId ?? p.user_id;

  const handleClick = useCallback(() => {
    onPinToggle?.(resolvedSlotId);
  }, [resolvedSlotId, onPinToggle]);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    useUiStore.getState().openModal('user-profile', { userId: p.user_id, serverId });
  }, [p.user_id, serverId]);

  const showModControls = variant !== 'thumbnail' && p.user_id !== myUserId && (canMute || canDeafen);

  // --- Spotlight variant ---
  if (variant === 'spotlight') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
        className="group relative h-full w-full rounded-xl bg-secondary overflow-hidden cursor-pointer"
      >
        {videoStream ? (
          <>
            <VideoRenderer stream={videoStream} className="h-full w-full object-cover" />
            <VoiceStatsOverlay userId={p.user_id} source="video" label={displayName} />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="relative">
              <Avatar src={avatarUrl} username={displayName} size={120} />
              <div
                className="pointer-events-none absolute inset-0 rounded-full border-[3px] border-success transition-opacity duration-100"
                style={{ margin: -3, opacity: isSpeaking ? 0.4 + audioLevel * 0.6 : 0 }}
              />
            </div>
          </div>
        )}

        {/* Pin indicator */}
        {isPinned && (
          <div className="absolute top-2 right-2 rounded-md bg-black/60 p-1.5">
            <Pin size={14} className="text-white" />
          </div>
        )}

        {/* Name overlay at bottom-left */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1.5">
          <span className="text-sm font-medium text-white truncate max-w-[200px]">{displayName}</span>
          {p.self_mute && <MicOff size={14} className="shrink-0 text-white/70" />}
          {p.self_deaf && <VolumeX size={14} className="shrink-0 text-white/70" />}
          {p.server_mute && <Tooltip content="Server Muted"><ShieldAlert size={14} className="shrink-0 text-danger" /></Tooltip>}
          {p.server_deaf && <Tooltip content="Server Deafened"><ShieldAlert size={14} className="shrink-0 text-danger" /></Tooltip>}
        </div>

        {showModControls && (
          <div className={cn('absolute top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity', isPinned ? 'right-10' : 'right-2')}>
            {canMute && (
              <IconButton
                size="sm"
                variant={p.server_mute ? 'danger' : 'ghost'}
                tooltip={p.server_mute ? 'Server Unmute' : 'Server Mute'}
                className="bg-black/40 text-white hover:bg-black/60"
                onClick={(e) => { e.stopPropagation(); onServerMute(p.user_id, !!p.server_mute); }}
              >
                <MicOff size={14} />
              </IconButton>
            )}
            {canDeafen && (
              <IconButton
                size="sm"
                variant={p.server_deaf ? 'danger' : 'ghost'}
                tooltip={p.server_deaf ? 'Server Undeafen' : 'Server Deafen'}
                className="bg-black/40 text-white hover:bg-black/60"
                onClick={(e) => { e.stopPropagation(); onServerDeafen(p.user_id, !!p.server_deaf); }}
              >
                <VolumeX size={14} />
              </IconButton>
            )}
          </div>
        )}

        <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <UserVolumeControl userId={p.user_id} />
        </div>
      </div>
    );
  }

  // --- Thumbnail variant ---
  if (variant === 'thumbnail') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
        className={cn(
          'group relative flex flex-col items-center justify-center shrink-0',
          'h-[120px] aspect-video rounded-lg bg-secondary overflow-hidden cursor-pointer',
          'transition-colors duration-150 hover:bg-hover',
          isSpeaking && 'ring-2 ring-success',
        )}
      >
        {videoStream ? (
          <VideoRenderer stream={videoStream} className="h-full w-full object-cover" />
        ) : (
          <div className="relative">
            <Avatar src={avatarUrl} username={displayName} size={48} />
            <div
              className="pointer-events-none absolute inset-0 rounded-full border-[2px] border-success transition-opacity duration-100"
              style={{ margin: -2, opacity: isSpeaking ? 0.4 + audioLevel * 0.6 : 0 }}
            />
          </div>
        )}
        {isPinned && (
          <div className="absolute top-1 right-1 rounded bg-black/60 p-1">
            <Pin size={10} className="text-white" />
          </div>
        )}
        <div className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5">
          <span className="text-xs font-medium text-white truncate max-w-[80px]">{displayName}</span>
          {p.self_mute && <MicOff size={10} className="shrink-0 text-white/70" />}
        </div>
      </div>
    );
  }

  // --- Default variant (unchanged layout, with pin click) ---
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25, delay: index * 0.05 }}
      className="flex flex-col gap-2"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
        className={cn(
          'group relative flex flex-col items-center justify-center gap-2',
          'rounded-xl bg-secondary p-4 cursor-pointer',
          'transition-colors duration-150 hover:bg-hover',
          'min-h-[140px] overflow-hidden',
          videoStream && 'p-0',
        )}
      >
        {videoStream ? (
          <div className="relative h-full w-full min-h-[140px]">
            <VideoRenderer stream={videoStream} />
            <VoiceStatsOverlay userId={p.user_id} source="video" label={displayName} />
          </div>
        ) : (
          <div className="relative flex items-center justify-center">
            <Avatar src={avatarUrl} username={displayName} size={72} />
            <div
              className="pointer-events-none absolute inset-0 rounded-full border-[3px] border-success transition-opacity duration-100"
              style={{ margin: -3, opacity: isSpeaking ? 0.4 + audioLevel * 0.6 : 0 }}
            />
          </div>
        )}

        <div className="flex items-center gap-1.5 px-2">
          <span className={cn('text-sm font-medium truncate max-w-[120px]', videoStream ? 'text-white drop-shadow-md' : 'text-primary')}>
            {displayName}
          </span>
          {p.self_mute && <MicOff size={14} className="shrink-0 text-muted" />}
          {p.self_deaf && <VolumeX size={14} className="shrink-0 text-muted" />}
          {p.server_mute && <Tooltip content="Server Muted"><ShieldAlert size={14} className="shrink-0 text-danger" /></Tooltip>}
          {p.server_deaf && <Tooltip content="Server Deafened"><ShieldAlert size={14} className="shrink-0 text-danger" /></Tooltip>}
        </div>

        {isPinned && (
          <div className="absolute top-1.5 right-1.5 rounded-md bg-black/40 p-1">
            <Pin size={12} className="text-white" />
          </div>
        )}

        {showModControls && (
          <div className={cn('absolute top-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity', isPinned ? 'right-8' : 'right-1.5')}>
            {canMute && (
              <IconButton
                size="sm"
                variant={p.server_mute ? 'danger' : 'ghost'}
                tooltip={p.server_mute ? 'Server Unmute' : 'Server Mute'}
                className="bg-black/40 text-white hover:bg-black/60"
                onClick={(e) => { e.stopPropagation(); onServerMute(p.user_id, !!p.server_mute); }}
              >
                <MicOff size={14} />
              </IconButton>
            )}
            {canDeafen && (
              <IconButton
                size="sm"
                variant={p.server_deaf ? 'danger' : 'ghost'}
                tooltip={p.server_deaf ? 'Server Undeafen' : 'Server Deafen'}
                className="bg-black/40 text-white hover:bg-black/60"
                onClick={(e) => { e.stopPropagation(); onServerDeafen(p.user_id, !!p.server_deaf); }}
              >
                <VolumeX size={14} />
              </IconButton>
            )}
          </div>
        )}

        <div className="absolute bottom-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <UserVolumeControl userId={p.user_id} />
        </div>
      </div>

      {screenStream && (
        <div className="relative rounded-xl bg-secondary overflow-hidden min-h-[100px]">
          <VideoRenderer stream={screenStream} className="object-contain" />
          <VoiceStatsOverlay userId={p.user_id} source="screen" label={displayName} />
          <div className="absolute bottom-2 left-2 flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
              <Monitor size={12} />
              <span>{displayName}&apos;s screen</span>
            </div>
            <ScreenAudioControl userId={p.user_id} />
          </div>
        </div>
      )}
    </motion.div>
  );
}
