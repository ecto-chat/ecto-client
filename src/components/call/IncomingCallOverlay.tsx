import { useEffect, useRef } from 'react';
import { useCall } from '../../hooks/useCall.js';
import { usePresenceStore } from '../../stores/presence.js';
import { Avatar } from '../common/Avatar.js';

export function IncomingCallOverlay() {
  const { callState, peer, mediaTypes, answerCall, rejectCall } = useCall();
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Get user's presence to suppress ring sound for DND
  const myPresence = usePresenceStore((s) => {
    // Find own presence — check if any entry is dnd
    // In practice, the store tracks others' presences, not self
    return null;
  });

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

  const callTypeLabel = mediaTypes.includes('video') ? 'Video Call' : 'Audio Call';

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
          <button
            className="call-accept-btn"
            onClick={answerCall}
            title="Accept"
          >
            &#128222;
          </button>
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
