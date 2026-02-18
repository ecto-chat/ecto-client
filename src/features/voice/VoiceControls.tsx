import { Mic, MicOff, Headphones, HeadphoneOff, Video, VideoOff, PhoneOff } from 'lucide-react';

import { IconButton } from '@/ui';

import { useVoiceStore } from '@/stores/voice';
import { useChannelStore } from '@/stores/channel';
import { useServerStore } from '@/stores/server';

import { useVoice } from '@/hooks/useVoice';

import { cn } from '@/lib/cn';

export function VoiceControls() {
  const {
    currentChannelId,
    currentServerId,
    voiceStatus,
    selfMuted,
    selfDeafened,
    isInVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    toggleCamera,
  } = useVoice();

  const pttEnabled = useVoiceStore((s) => s.pttEnabled);
  const pttActive = useVoiceStore((s) => s.pttActive);
  const pttKey = useVoiceStore((s) => s.pttKey);

  if (!isInVoice || !currentServerId || !currentChannelId) return null;

  const channelName =
    useChannelStore.getState().channels.get(currentServerId)?.get(currentChannelId)?.name ?? 'Voice';
  const serverName =
    useServerStore.getState().servers.get(currentServerId)?.server_name ?? 'Server';
  const pttKeyLabel = pttKey === ' ' ? 'Space' : pttKey;

  const cameraProducerActive = useVoiceStore.getState().producers.has('video');

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 bg-secondary border-t border-border">
      <div className="flex flex-col min-w-0">
        <span
          className={cn(
            'text-xs font-medium',
            voiceStatus === 'connecting' ? 'text-warning' : 'text-success',
          )}
        >
          {voiceStatus === 'connecting' ? 'Connecting...' : 'Voice Connected'}
        </span>
        <span className="text-xs text-muted truncate">
          {channelName} / {serverName}
        </span>
      </div>

      {pttEnabled && (
        <span
          className={cn(
            'text-2xs font-medium px-2 py-0.5 rounded-sm',
            pttActive ? 'bg-success-subtle text-success' : 'bg-tertiary text-muted',
          )}
        >
          {pttActive ? 'Transmitting...' : `Push [${pttKeyLabel}] to talk`}
        </span>
      )}

      <div className="flex items-center gap-1">
        <IconButton
          tooltip={selfMuted ? 'Unmute' : 'Mute'}
          size="sm"
          variant={selfMuted ? 'danger' : 'default'}
          className={cn(selfMuted && 'bg-danger text-white hover:bg-danger-hover')}
          onClick={toggleMute}
        >
          {selfMuted ? <MicOff size={16} /> : <Mic size={16} />}
        </IconButton>

        <IconButton
          tooltip={selfDeafened ? 'Undeafen' : 'Deafen'}
          size="sm"
          variant={selfDeafened ? 'danger' : 'default'}
          className={cn(selfDeafened && 'bg-danger text-white hover:bg-danger-hover')}
          onClick={toggleDeafen}
        >
          {selfDeafened ? <HeadphoneOff size={16} /> : <Headphones size={16} />}
        </IconButton>

        <IconButton
          tooltip={cameraProducerActive ? 'Turn Off Camera' : 'Turn On Camera'}
          size="sm"
          onClick={toggleCamera}
        >
          {cameraProducerActive ? <VideoOff size={16} /> : <Video size={16} />}
        </IconButton>

        <IconButton
          tooltip="Disconnect"
          size="sm"
          variant="danger"
          onClick={leaveVoice}
        >
          <PhoneOff size={16} />
        </IconButton>
      </div>
    </div>
  );
}
