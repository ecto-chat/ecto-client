import { useEffect, useRef, useState } from 'react';

import { motion } from 'motion/react';
import { MicOff } from 'lucide-react';

import { Avatar } from '@/ui';

import { useCall } from '@/hooks/useCall';
import { cn } from '@/lib/cn';
import { playOutgoingRingback } from '@/lib/ringtone';

import { CallControls } from './CallControls';

export function ActiveCallOverlay() {
  const {
    callState, peer, startedAt, endReason, peerMuted,
    localVideoStream, localScreenStream,
    remoteVideoStream, remoteScreenStream,
    localSpeaking, remoteSpeaking, answeredElsewhere,
  } = useCall();

  const [elapsed, setElapsed] = useState(0);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteScreenRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localScreenRef = useRef<HTMLVideoElement>(null);

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

  useEffect(() => {
    if (remoteVideoRef.current && remoteVideoStream) {
      remoteVideoRef.current.srcObject = remoteVideoStream;
    }
  }, [remoteVideoStream, !!remoteScreenStream]);

  useEffect(() => {
    if (remoteScreenRef.current && remoteScreenStream) {
      remoteScreenRef.current.srcObject = remoteScreenStream;
    }
  }, [remoteScreenStream]);

  useEffect(() => {
    if (localVideoRef.current && localVideoStream) {
      localVideoRef.current.srcObject = localVideoStream;
    }
  }, [localVideoStream]);

  useEffect(() => {
    if (localScreenRef.current && localScreenStream) {
      localScreenRef.current.srcObject = localScreenStream;
    }
  }, [localScreenStream]);

  if (answeredElsewhere) return null;

  const isVisible =
    callState === 'outgoing_ringing' || callState === 'connecting' ||
    callState === 'active' || callState === 'ended';

  if (!isVisible || !peer) return null;

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

  const hasRemoteScreen = !!remoteScreenStream;
  const hasRemoteVideo = !!remoteVideoStream;
  const speakingRing = 'ring-2 ring-status-online';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="fixed inset-0 z-[300] flex flex-col items-center justify-between bg-[rgba(12,12,20,0.95)] backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex flex-col items-center gap-1 pt-10">
        <span className="text-lg font-medium text-primary">{peer.display_name ?? peer.username}</span>
        {callState === 'active' && <span className="text-sm text-muted">{formatTime(elapsed)}</span>}
        {statusLabel && <span className="text-sm text-secondary">{statusLabel}</span>}
      </div>

      {/* Video container */}
      <div className="relative flex flex-1 items-center justify-center w-full p-6">
        {hasRemoteScreen ? (
          <video ref={remoteScreenRef} className="max-h-full max-w-full rounded-xl object-contain" autoPlay playsInline />
        ) : hasRemoteVideo ? (
          <video ref={remoteVideoRef} className={cn('max-h-full max-w-full rounded-xl object-contain', remoteSpeaking && speakingRing)} autoPlay playsInline />
        ) : (
          <div className={cn('relative flex items-center justify-center', remoteSpeaking && speakingRing, 'rounded-full')}>
            <Avatar src={peer.avatar_url} username={peer.username} size={120} />
            {peerMuted && <MicOff className="absolute -bottom-1 -right-1 size-5 text-danger" />}
          </div>
        )}

        {hasRemoteScreen && hasRemoteVideo && (
          <video ref={remoteVideoRef} className={cn('absolute bottom-8 right-8 h-32 w-auto rounded-lg object-cover', remoteSpeaking && speakingRing)} autoPlay playsInline />
        )}

        {localVideoStream && (
          <video ref={localVideoRef} className={cn('absolute bottom-8 left-8 h-28 w-auto rounded-lg object-cover', localSpeaking && speakingRing)} autoPlay playsInline muted />
        )}

        {localScreenStream && (
          <video ref={localScreenRef} className="absolute top-8 right-8 h-24 w-auto rounded-lg object-cover opacity-80" autoPlay playsInline muted />
        )}
      </div>

      {callState !== 'ended' && <CallControls />}
    </motion.div>
  );
}
