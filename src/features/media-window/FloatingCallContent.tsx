import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/cn';
import { Avatar } from '@/ui';
import { useCallStore } from '@/stores/call';

export function FloatingCallContent() {
  const peer = useCallStore((s) => s.peer);
  const remoteVideoStream = useCallStore((s) => s.remoteVideoStream);
  const remoteScreenStream = useCallStore((s) => s.remoteScreenStream);
  const remoteSpeaking = useCallStore((s) => s.remoteSpeaking);
  const startedAt = useCallStore((s) => s.startedAt);
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  const [elapsed, setElapsed] = useState(0);

  // Prioritize screen share over camera
  const primaryStream = remoteScreenStream ?? remoteVideoStream;
  const primaryRef = remoteScreenStream ? screenRef : videoRef;

  useEffect(() => {
    if (screenRef.current && remoteScreenStream) {
      screenRef.current.srcObject = remoteScreenStream;
    }
  }, [remoteScreenStream]);

  useEffect(() => {
    if (videoRef.current && remoteVideoStream) {
      videoRef.current.srcObject = remoteVideoStream;
    }
  }, [remoteVideoStream]);

  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (!peer) return null;

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  const timeStr = `${m}:${s.toString().padStart(2, '0')}`;

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden">
      {primaryStream ? (
        <>
          <video
            ref={primaryRef}
            className={cn(
              'h-full w-full object-cover',
              remoteSpeaking && !remoteScreenStream && 'ring-2 ring-status-online',
            )}
            autoPlay
            playsInline
          />
          {/* Show camera PiP when screen is the primary */}
          {remoteScreenStream && remoteVideoStream && (
            <video
              ref={videoRef}
              className={cn(
                'absolute bottom-6 right-2 h-14 w-auto rounded object-cover',
                remoteSpeaking && 'ring-2 ring-status-online',
              )}
              autoPlay
              playsInline
            />
          )}
        </>
      ) : (
        <div
          className={cn(
            'flex items-center justify-center rounded-full',
            remoteSpeaking && 'ring-2 ring-status-online',
          )}
        >
          <Avatar src={peer.avatar_url} username={peer.username} size={64} />
        </div>
      )}
      <span className="absolute bottom-1 right-2 text-[10px] font-medium text-white/70 bg-black/40 px-1.5 py-0.5 rounded">
        {timeStr}
      </span>
    </div>
  );
}
