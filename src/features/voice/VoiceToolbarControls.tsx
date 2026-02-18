import {
  Mic, MicOff, Headphones, HeadphoneOff,
  Video, VideoOff, MonitorUp, MonitorOff,
  PhoneOff, ChevronUp, Settings,
} from 'lucide-react';

import { IconButton, DropdownMenu, DropdownMenuTrigger } from '@/ui';

import { useVoiceStore } from '@/stores/voice';

import { useVoice } from '@/hooks/useVoice';

import { cn } from '@/lib/cn';

import { DeviceSelector, QualitySelector } from '@/features/call';

export function VoiceToolbarControls() {
  const producers = useVoiceStore((s) => s.producers);
  const {
    selfMuted, selfDeafened, leaveVoice,
    toggleMute, toggleDeafen, toggleCamera, toggleScreenShare,
    switchAudioDevice, switchAudioOutput, switchVideoDevice,
  } = useVoice();

  const hasCamera = producers.has('video');
  const hasScreen = producers.has('screen');

  return (
    <div className="flex items-center justify-center gap-2">
      {/* Mute + audio input */}
      <div className="flex items-center gap-0.5">
        <IconButton tooltip={selfMuted ? 'Unmute' : 'Mute'} size="md" variant={selfMuted ? 'danger' : 'default'} className={cn(selfMuted && 'bg-danger text-white hover:bg-danger-hover')} onClick={toggleMute}>
          {selfMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton size="sm" variant="ghost" tooltip="Audio input">
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
        <IconButton tooltip={hasCamera ? 'Turn Off Camera' : 'Turn On Camera'} size="md" onClick={toggleCamera}>
          {hasCamera ? <VideoOff size={18} /> : <Video size={18} />}
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton size="sm" variant="ghost" tooltip="Video input">
              <ChevronUp size={12} />
            </IconButton>
          </DropdownMenuTrigger>
          <DeviceSelector kind="videoinput" onSelect={switchVideoDevice} />
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton size="sm" variant="ghost" tooltip="Camera quality">
              <Settings size={12} />
            </IconButton>
          </DropdownMenuTrigger>
          <QualitySelector kind="video" />
        </DropdownMenu>
      </div>

      {/* Screen share + quality */}
      <div className="flex items-center gap-0.5">
        <IconButton tooltip={hasScreen ? 'Stop Sharing' : 'Share Screen'} size="md" variant={hasScreen ? 'danger' : 'default'} className={cn(hasScreen && 'bg-accent text-white hover:bg-accent-hover')} onClick={toggleScreenShare}>
          {hasScreen ? <MonitorOff size={18} /> : <MonitorUp size={18} />}
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton size="sm" variant="ghost" tooltip="Screen quality">
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
