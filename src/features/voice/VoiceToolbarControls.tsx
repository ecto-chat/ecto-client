import {
  Mic, MicOff, Headphones, HeadphoneOff,
  Video, VideoOff, MonitorUp, MonitorOff,
  PhoneOff, ChevronUp, Settings,
} from 'lucide-react';
import { Permissions } from 'ecto-shared';

import { IconButton, DropdownMenu, DropdownMenuTrigger } from '@/ui';

import { useVoiceStore } from '@/stores/voice';
import { useChannelStore } from '@/stores/channel';

import { useVoice } from '@/hooks/useVoice';

import { cn } from '@/lib/cn';

import { DeviceSelector, QualitySelector } from '@/features/call';

export function VoiceToolbarControls() {
  const producers = useVoiceStore((s) => s.producers);
  const {
    currentServerId, currentChannelId,
    selfMuted, selfDeafened, leaveVoice,
    toggleMute, toggleDeafen, toggleCamera, toggleScreenShare,
    switchAudioDevice, switchAudioOutput, switchVideoDevice,
  } = useVoice();

  const myPerms = useChannelStore((s) =>
    currentServerId && currentChannelId
      ? s.channels.get(currentServerId)?.get(currentChannelId)?.my_permissions
      : undefined,
  );
  const canSpeak = myPerms === undefined || (myPerms & Permissions.SPEAK_VOICE) !== 0;
  const canVideo = myPerms === undefined || (myPerms & Permissions.USE_VIDEO) !== 0;
  const canScreenShare = myPerms === undefined || (myPerms & Permissions.SCREEN_SHARE) !== 0;

  const hasCamera = producers.has('video');
  const hasScreen = producers.has('screen');

  return (
    <div className="flex items-center justify-center gap-2">
      {/* Mute + audio input */}
      <div className="flex items-center gap-0.5">
        <IconButton tooltip={!canSpeak ? "You don't have permission to speak" : selfMuted ? 'Unmute' : 'Mute'} size="md" variant={selfMuted ? 'danger' : 'default'} className={cn(selfMuted && 'bg-danger text-white hover:bg-danger-hover')} onClick={canSpeak ? toggleMute : undefined} disabled={!canSpeak}>
          {selfMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton size="sm" variant="ghost" tooltip="Audio input" disabled={!canSpeak}>
              <ChevronUp size={12} />
            </IconButton>
          </DropdownMenuTrigger>
          <DeviceSelector kind="audioinput" onSelect={switchAudioDevice} />
        </DropdownMenu>
      </div>

      {/* Deafen + audio output */}
      <div className="flex items-center gap-0.5">
        <IconButton tooltip={selfDeafened ? 'Undeafen' : 'Deafen'} size="md" variant={selfDeafened ? 'danger' : 'default'} className={cn(selfDeafened && 'bg-danger text-white hover:bg-danger-hover')} onClick={toggleDeafen}>
          {selfDeafened ? <HeadphoneOff size={18} /> : <Headphones size={18} />}
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton size="sm" variant="ghost" tooltip="Audio output">
              <ChevronUp size={12} />
            </IconButton>
          </DropdownMenuTrigger>
          <DeviceSelector kind="audiooutput" onSelect={switchAudioOutput} />
        </DropdownMenu>
      </div>

      {/* Camera + video input + quality */}
      <div className="flex items-center gap-0.5">
        <IconButton tooltip={!canVideo ? "You don't have permission to use video" : hasCamera ? 'Turn Off Camera' : 'Turn On Camera'} size="md" onClick={canVideo ? toggleCamera : undefined} disabled={!canVideo}>
          {hasCamera ? <VideoOff size={18} /> : <Video size={18} />}
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton size="sm" variant="ghost" tooltip="Video input" disabled={!canVideo}>
              <ChevronUp size={12} />
            </IconButton>
          </DropdownMenuTrigger>
          <DeviceSelector kind="videoinput" onSelect={switchVideoDevice} />
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton size="sm" variant="ghost" tooltip="Camera quality" disabled={!canVideo}>
              <Settings size={12} />
            </IconButton>
          </DropdownMenuTrigger>
          <QualitySelector kind="video" />
        </DropdownMenu>
      </div>

      {/* Screen share + quality */}
      <div className="flex items-center gap-0.5">
        <IconButton tooltip={!canScreenShare ? "You don't have permission to share screen" : hasScreen ? 'Stop Sharing' : 'Share Screen'} size="md" variant={hasScreen ? 'danger' : 'default'} className={cn(hasScreen && 'bg-accent text-white hover:bg-accent-hover')} onClick={canScreenShare ? toggleScreenShare : undefined} disabled={!canScreenShare}>
          {hasScreen ? <MonitorOff size={18} /> : <MonitorUp size={18} />}
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton size="sm" variant="ghost" tooltip="Screen quality" disabled={!canScreenShare}>
              <Settings size={12} />
            </IconButton>
          </DropdownMenuTrigger>
          <QualitySelector kind="screen" />
        </DropdownMenu>
      </div>

      {/* Disconnect */}
      <IconButton tooltip="Leave Voice" size="md" variant="danger" onClick={leaveVoice}>
        <PhoneOff size={18} />
      </IconButton>
    </div>
  );
}
