import { useEffect, useRef, useState } from 'react';
import { useCall } from '../../hooks/useCall.js';
import { Avatar } from '../common/Avatar.js';
import { CallControls } from './CallControls.js';

export function ActiveCallOverlay() {
  const {
    callState,
    peer,
    startedAt,
    endReason,
    peerMuted,
    peerVideoEnabled,
    peerScreenSharing,
    localVideoStream,
    localScreenStream,
    remoteVideoStream,
    remoteScreenStream,
    localSpeaking,
    remoteSpeaking,
  } = useCall();

  const [elapsed, setElapsed] = useState(0);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteScreenRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localScreenRef = useRef<HTMLVideoElement>(null);

  // Update call timer
  useEffect(() => {
    if (callState !== 'active' || !startedAt) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [callState, startedAt]);

  // Attach remote video
  useEffect(() => {
    if (remoteVideoRef.current && remoteVideoStream) {
      remoteVideoRef.current.srcObject = remoteVideoStream;
    }
  }, [remoteVideoStream]);

  // Attach remote screen
  useEffect(() => {
    if (remoteScreenRef.current && remoteScreenStream) {
      remoteScreenRef.current.srcObject = remoteScreenStream;
    }
  }, [remoteScreenStream]);

  // Attach local video
  useEffect(() => {
    if (localVideoRef.current && localVideoStream) {
      localVideoRef.current.srcObject = localVideoStream;
    }
  }, [localVideoStream]);

  // Attach local screen preview
  useEffect(() => {
    if (localScreenRef.current && localScreenStream) {
      localScreenRef.current.srcObject = localScreenStream;
    }
  }, [localScreenStream]);

  const isVisible =
    callState === 'outgoing_ringing' ||
    callState === 'connecting' ||
    callState === 'active' ||
    callState === 'ended';

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

  // Determine the primary display: screen share takes priority over camera
  const hasRemoteScreen = !!remoteScreenStream;
  const hasRemoteVideo = !!remoteVideoStream;

  return (
    <div className={`call-active-overlay ${hasRemoteScreen ? 'call-active-overlay-wide' : ''}`}>
      <div className="call-active-header">
        <span className="call-peer-name">
          {peer.display_name ?? peer.username}
        </span>
        {callState === 'active' && (
          <span className="call-timer">{formatTime(elapsed)}</span>
        )}
        {statusLabel && <span className="call-status-label">{statusLabel}</span>}
      </div>

      <div className="call-video-container">
        {/* Primary display: screen share or camera or avatar */}
        {hasRemoteScreen ? (
          <video
            ref={remoteScreenRef}
            className="call-remote-video call-screen-video"
            autoPlay
            playsInline
          />
        ) : hasRemoteVideo ? (
          <video
            ref={remoteVideoRef}
            className={`call-remote-video ${remoteSpeaking ? 'speaking' : ''}`}
            autoPlay
            playsInline
          />
        ) : (
          <div className={`call-avatar-display ${remoteSpeaking ? 'speaking' : ''}`}>
            <Avatar
              src={peer.avatar_url}
              username={peer.username}
              size={120}
            />
            {peerMuted && <span className="call-muted-icon">{'\u{1F507}'}</span>}
          </div>
        )}

        {/* When screen sharing is primary, show remote camera as secondary PiP */}
        {hasRemoteScreen && hasRemoteVideo && (
          <video
            ref={remoteVideoRef}
            className={`call-pip call-pip-remote ${remoteSpeaking ? 'speaking' : ''}`}
            autoPlay
            playsInline
          />
        )}

        {/* Local video PiP */}
        {localVideoStream && (
          <video
            ref={localVideoRef}
            className={`call-pip ${localSpeaking ? 'speaking' : ''}`}
            autoPlay
            playsInline
            muted
          />
        )}

        {/* Local screen share preview (small indicator) */}
        {localScreenStream && (
          <video
            ref={localScreenRef}
            className="call-pip call-pip-screen"
            autoPlay
            playsInline
            muted
          />
        )}
      </div>

      {callState !== 'ended' && <CallControls />}
    </div>
  );
}
