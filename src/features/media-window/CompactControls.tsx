import { Mic, MicOff, Video, VideoOff, HeadphoneOff, Headphones, PhoneOff, LogOut } from 'lucide-react';

import { IconButton } from '@/ui';
import { useCall } from '@/hooks/useCall';
import { useVoice } from '@/hooks/useVoice';

type CompactControlsProps = {
  mediaType: 'call' | 'voice';
};

export function CompactControls({ mediaType }: CompactControlsProps) {
  if (mediaType === 'call') return <CallCompactControls />;
  return <VoiceCompactControls />;
}

function CallCompactControls() {
  const { selfMuted, videoEnabled, toggleMute, toggleVideo, endCall } = useCall();

  return (
    <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-black/30">
      <IconButton
        size="sm"
        tooltip={selfMuted ? 'Unmute' : 'Mute'}
        onClick={toggleMute}
        className={selfMuted ? 'bg-danger/30 text-danger hover:bg-danger/40' : 'text-white/80 hover:bg-white/10'}
      >
        {selfMuted ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
      </IconButton>
      <IconButton
        size="sm"
        tooltip={videoEnabled ? 'Stop Camera' : 'Start Camera'}
        onClick={toggleVideo}
        className={videoEnabled ? 'bg-accent/30 text-accent hover:bg-accent/40' : 'text-white/80 hover:bg-white/10'}
      >
        {videoEnabled ? <Video className="size-3.5" /> : <VideoOff className="size-3.5" />}
      </IconButton>
      <IconButton
        size="sm"
        tooltip="End Call"
        onClick={endCall}
        className="bg-danger text-white hover:bg-danger-hover"
      >
        <PhoneOff className="size-3.5" />
      </IconButton>
    </div>
  );
}

function VoiceCompactControls() {
  const { selfMuted, selfDeafened, toggleMute, toggleDeafen, leaveVoice } = useVoice();

  return (
    <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-black/30">
      <IconButton
        size="sm"
        tooltip={selfMuted ? 'Unmute' : 'Mute'}
        onClick={toggleMute}
        className={selfMuted ? 'bg-danger/30 text-danger hover:bg-danger/40' : 'text-white/80 hover:bg-white/10'}
      >
        {selfMuted ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
      </IconButton>
      <IconButton
        size="sm"
        tooltip={selfDeafened ? 'Undeafen' : 'Deafen'}
        onClick={toggleDeafen}
        className={selfDeafened ? 'bg-danger/30 text-danger hover:bg-danger/40' : 'text-white/80 hover:bg-white/10'}
      >
        {selfDeafened ? <HeadphoneOff className="size-3.5" /> : <Headphones className="size-3.5" />}
      </IconButton>
      <IconButton
        size="sm"
        tooltip="Disconnect"
        onClick={leaveVoice}
        className="bg-danger text-white hover:bg-danger-hover"
      >
        <LogOut className="size-3.5" />
      </IconButton>
    </div>
  );
}
