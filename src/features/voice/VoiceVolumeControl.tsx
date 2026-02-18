import { useCallback, useEffect, useState } from 'react';

import { Volume2, VolumeX, Volume1 } from 'lucide-react';

import { IconButton, Tooltip } from '@/ui';

import { useVoiceStore } from '@/stores/voice';
import { useAuthStore } from '@/stores/auth';

import { useVoice } from '@/hooks/useVoice';

import { cn } from '@/lib/cn';

function getAudioElements(userId: string, source: 'mic' | 'screen-audio'): HTMLAudioElement[] {
  const store = useVoiceStore.getState();
  const elements: HTMLAudioElement[] = [];
  for (const [cid, meta] of store.consumerMeta.entries()) {
    if (meta.userId === userId && meta.source === source) {
      const el = document.querySelector(`audio[data-consumer-id="${cid}"]`) as HTMLAudioElement | null;
      if (el) elements.push(el);
    }
  }
  return elements;
}

type VolumeSliderProps = {
  userId: string;
  source: 'mic' | 'screen-audio';
  className?: string;
};

function VolumeSlider({ userId, source, className }: VolumeSliderProps) {
  const storageKey = `ecto-volume:${source}:${userId}`;
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved !== null ? parseFloat(saved) : 1;
  });
  const [preMuteVolume, setPreMuteVolume] = useState(1);
  const myUserId = useAuthStore((s) => s.user?.id);
  const { toggleScreenAudioMute } = useVoice();

  const isMuted = volume === 0;
  const isOwner = userId === myUserId;

  const applyVolume = useCallback(
    (v: number) => {
      const els = getAudioElements(userId, source);
      for (const el of els) {
        el.volume = v;
        el.muted = v === 0;
      }
      setVolume(v);
      localStorage.setItem(storageKey, String(v));
    },
    [userId, source, storageKey],
  );

  const handleMuteToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isOwner && source === 'screen-audio') {
        toggleScreenAudioMute(userId);
      }
      if (isMuted) {
        applyVolume(preMuteVolume || 1);
      } else {
        setPreMuteVolume(volume);
        applyVolume(0);
      }
    },
    [isMuted, volume, preMuteVolume, applyVolume, isOwner, source, toggleScreenAudioMute, userId],
  );

  useEffect(() => {
    if (volume !== 1) applyVolume(volume);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const VolumeIcon = isMuted ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className={cn('flex items-center gap-1.5', className)} onClick={(e) => e.stopPropagation()}>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={volume}
        onChange={(e) => applyVolume(parseFloat(e.target.value))}
        className="h-1 w-16 cursor-pointer accent-accent"
      />
      <span className="text-2xs text-muted w-7 text-right">{Math.round(volume * 100)}%</span>
      <Tooltip content={isMuted ? 'Unmute' : 'Mute'}>
        <IconButton size="sm" variant="ghost" onClick={handleMuteToggle}>
          <VolumeIcon size={14} />
        </IconButton>
      </Tooltip>
    </div>
  );
}

export function ScreenAudioControl({ userId }: { userId: string }) {
  const myUserId = useAuthStore((s) => s.user?.id);
  const producers = useVoiceStore((s) => s.producers);
  const consumerMeta = useVoiceStore((s) => s.consumerMeta);

  const isOwner = userId === myUserId;
  let hasScreenAudio = false;
  if (isOwner) {
    hasScreenAudio = producers.has('screen-audio');
  } else {
    for (const meta of consumerMeta.values()) {
      if (meta.userId === userId && meta.source === 'screen-audio') {
        hasScreenAudio = true;
        break;
      }
    }
  }

  if (!hasScreenAudio) return null;

  return <VolumeSlider userId={userId} source="screen-audio" />;
}

export function UserVolumeControl({ userId }: { userId: string }) {
  const myUserId = useAuthStore((s) => s.user?.id);
  const consumerMeta = useVoiceStore((s) => s.consumerMeta);

  if (userId === myUserId) return null;

  let hasMicAudio = false;
  for (const meta of consumerMeta.values()) {
    if (meta.userId === userId && meta.source === 'mic') {
      hasMicAudio = true;
      break;
    }
  }

  if (!hasMicAudio) return null;

  return <VolumeSlider userId={userId} source="mic" />;
}
