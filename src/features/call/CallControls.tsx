import {
  Mic,
  MicOff,
  Headphones,
  HeadphoneOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  ChevronUp,
  Settings,
} from 'lucide-react';

import {
  IconButton,
  DropdownMenu,
  DropdownMenuTrigger,
} from '@/ui';

import { useCall } from '@/hooks/useCall';

import { DeviceSelector } from './DeviceSelector';
import { QualitySelector } from './QualitySelector';

export function CallControls() {
  const {
    selfMuted,
    selfDeafened,
    videoEnabled,
    screenSharing,
    toggleMute,
    toggleDeafen,
    toggleVideo,
    toggleScreenShare,
    endCall,
    switchAudioDevice,
    switchAudioOutput,
    switchVideoDevice,
  } = useCall();

  return (
    <div className="flex items-center justify-center gap-2 p-4">
      {/* Mute */}
      <div className="flex items-center gap-0.5">
        <IconButton
          tooltip={selfMuted ? 'Unmute' : 'Mute'}
          onClick={toggleMute}
          className={selfMuted ? 'bg-danger/20 text-danger hover:bg-danger/30' : ''}
        >
          {selfMuted ? <MicOff className="size-[18px]" /> : <Mic className="size-[18px]" />}
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton size="sm" tooltip="Select audio input" variant="ghost">
              <ChevronUp className="size-3.5" />
            </IconButton>
          </DropdownMenuTrigger>
          <DeviceSelector kind="audioinput" onSelect={switchAudioDevice} />
        </DropdownMenu>
      </div>

      {/* Deafen */}
      <div className="flex items-center gap-0.5">
        <IconButton
          tooltip={selfDeafened ? 'Undeafen' : 'Deafen'}
          onClick={toggleDeafen}
          className={selfDeafened ? 'bg-danger/20 text-danger hover:bg-danger/30' : ''}
        >
          {selfDeafened ? <HeadphoneOff className="size-[18px]" /> : <Headphones className="size-[18px]" />}
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton size="sm" tooltip="Select audio output" variant="ghost">
              <ChevronUp className="size-3.5" />
            </IconButton>
          </DropdownMenuTrigger>
          <DeviceSelector kind="audiooutput" onSelect={switchAudioOutput} />
        </DropdownMenu>
      </div>

      {/* Video */}
      <div className="flex items-center gap-0.5">
        <IconButton
          tooltip={videoEnabled ? 'Stop Camera' : 'Start Camera'}
          onClick={toggleVideo}
          className={videoEnabled ? 'bg-accent/20 text-accent hover:bg-accent/30' : ''}
        >
          {videoEnabled ? <Video className="size-[18px]" /> : <VideoOff className="size-[18px]" />}
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton size="sm" tooltip="Select camera" variant="ghost">
              <ChevronUp className="size-3.5" />
            </IconButton>
          </DropdownMenuTrigger>
          <DeviceSelector kind="videoinput" onSelect={switchVideoDevice} />
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton size="sm" tooltip="Camera quality" variant="ghost">
              <Settings className="size-3.5" />
            </IconButton>
          </DropdownMenuTrigger>
          <QualitySelector kind="video" />
        </DropdownMenu>
      </div>

      {/* Screen share */}
      <div className="flex items-center gap-0.5">
        <IconButton
          tooltip={screenSharing ? 'Stop Sharing' : 'Share Screen'}
          onClick={toggleScreenShare}
          className={screenSharing ? 'bg-accent/20 text-accent hover:bg-accent/30' : ''}
        >
          {screenSharing ? <Monitor className="size-[18px]" /> : <MonitorOff className="size-[18px]" />}
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton size="sm" tooltip="Screen share quality" variant="ghost">
              <Settings className="size-3.5" />
            </IconButton>
          </DropdownMenuTrigger>
          <QualitySelector kind="screen" />
        </DropdownMenu>
      </div>

      {/* End call */}
      <IconButton
        tooltip="End Call"
        onClick={endCall}
        className="bg-danger text-white hover:bg-danger-hover"
      >
        <PhoneOff className="size-[18px]" />
      </IconButton>
    </div>
  );
}
