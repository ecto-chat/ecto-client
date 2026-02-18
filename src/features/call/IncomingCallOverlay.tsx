import { useEffect, useRef } from 'react';

import { motion } from 'motion/react';
import { Phone, Video, PhoneOff, ArrowRightLeft, X } from 'lucide-react';

import { Avatar, IconButton } from '@/ui';

import { useCall } from '@/hooks/useCall';

export function IncomingCallOverlay() {
  const { callState, peer, mediaTypes, answeredElsewhere, answerCall, rejectCall, transferCall, dismissCall } = useCall();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (callState !== 'incoming_ringing') return;
    timerRef.current = setTimeout(() => {
      // Server will send call.ended with timeout
    }, 30_000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [callState]);

  if (callState !== 'incoming_ringing' || !peer || answeredElsewhere) return null;

  const isVideoCall = mediaTypes.includes('video');
  const callTypeLabel = isVideoCall ? 'Video Call' : 'Audio Call';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="flex flex-col items-center gap-5 rounded-xl border border-border bg-secondary p-8"
      >
        <Avatar src={peer.avatar_url} username={peer.username} size={80} />

        <div className="flex flex-col items-center gap-1">
          <span className="text-lg font-medium text-primary">
            {peer.display_name ?? peer.username}
          </span>
          <span className="text-sm text-muted">{callTypeLabel}</span>
        </div>

        <div className="flex items-center gap-3">
          {isVideoCall ? (
            <>
              <IconButton
                size="lg"
                tooltip="Answer with Video"
                onClick={() => answerCall(true)}
                className="bg-success text-white hover:bg-success/80"
              >
                <Video className="size-5" />
              </IconButton>
              <IconButton
                size="lg"
                tooltip="Answer with Audio"
                onClick={() => answerCall(false)}
                className="bg-success text-white hover:bg-success/80"
              >
                <Phone className="size-5" />
              </IconButton>
              <IconButton
                size="lg"
                tooltip="Decline"
                onClick={rejectCall}
                className="bg-danger text-white hover:bg-danger-hover"
              >
                <PhoneOff className="size-5" />
              </IconButton>
            </>
          ) : (
            <>
              <IconButton
                size="lg"
                tooltip="Accept"
                onClick={() => answerCall(false)}
                className="bg-success text-white hover:bg-success/80"
              >
                <Phone className="size-5" />
              </IconButton>
              <IconButton
                size="lg"
                tooltip="Decline"
                onClick={rejectCall}
                className="bg-danger text-white hover:bg-danger-hover"
              >
                <PhoneOff className="size-5" />
              </IconButton>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
