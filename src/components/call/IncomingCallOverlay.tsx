import { useEffect, useRef } from 'react';
import { useCall } from '../../hooks/useCall.js';
import { Avatar } from '../common/Avatar.js';

export function IncomingCallOverlay() {
  const { callState, peer, mediaTypes, answerCall, rejectCall } = useCall();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (callState !== 'incoming_ringing') return;

    // Auto-dismiss after 30s (matches server timeout)
    timerRef.current = setTimeout(() => {
      // Server will send call.ended with timeout
    }, 30_000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [callState]);

  if (callState !== 'incoming_ringing' || !peer) return null;

  const isVideoCall = mediaTypes.includes('video');
  const callTypeLabel = isVideoCall ? 'Video Call' : 'Audio Call';

  return (
    <div className="call-incoming-overlay">
      <div className="call-incoming-card">
        <Avatar
          src={peer.avatar_url}
          username={peer.username}
          size={80}
        />
        <div className="call-incoming-info">
          <div className="call-incoming-name">
            {peer.display_name ?? peer.username}
          </div>
          <div className="call-incoming-label">{callTypeLabel}</div>
        </div>
        <div className="call-incoming-actions">
          {isVideoCall ? (
            <>
              <button
                className="call-accept-btn"
                onClick={() => answerCall(true)}
                title="Answer with Video"
              >
                &#127909;
              </button>
              <button
                className="call-accept-btn audio-only"
                onClick={() => answerCall(false)}
                title="Answer with Audio"
              >
                &#128222;
              </button>
            </>
          ) : (
            <button
              className="call-accept-btn"
              onClick={() => answerCall(false)}
              title="Accept"
            >
              &#128222;
            </button>
          )}
          <button
            className="call-reject-btn"
            onClick={rejectCall}
            title="Decline"
          >
            &#128222;
          </button>
        </div>
      </div>
    </div>
  );
}
