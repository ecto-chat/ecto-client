import { useState, useEffect } from 'react';
import { useCall } from '../../hooks/useCall.js';

export function CallBanner() {
  const { callState, peer, startedAt } = useCall();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (callState !== 'active' || !startedAt) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [callState, startedAt]);

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
