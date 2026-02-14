import { useState, useEffect } from 'react';
import { useCall } from '../../hooks/useCall.js';

export function CallBanner() {
  const { callState, peer, startedAt, answeredElsewhere, isInitiator, transferCall, dismissCall } = useCall();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (callState !== 'active' || !startedAt) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [callState, startedAt]);

  // Show "on another device" banner for sessions where the call is elsewhere
  if (answeredElsewhere && peer && callState !== 'idle' && callState !== 'ended') {
    return (
      <div className="call-banner">
        <span className="call-banner-text">
          Call with <strong>{peer.display_name ?? peer.username}</strong> active on another device
        </span>
        <button className="call-banner-transfer" onClick={transferCall}>Transfer Here</button>
        <button className="call-banner-dismiss" onClick={dismissCall}>Dismiss</button>
      </div>
    );
  }

  if (callState !== 'active' || !peer) return null;

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  const timeStr = `${m}:${s.toString().padStart(2, '0')}`;

  return (
    <div className="call-banner">
      <span className="call-banner-text">
        In call with <strong>{peer.display_name ?? peer.username}</strong> &middot; {timeStr}
      </span>
    </div>
  );
}
