import { useState, useEffect } from 'react';
import { Maximize2 } from 'lucide-react';

import { Button, IconButton } from '@/ui';

import { useCall } from '@/hooks/useCall';
import { useUiStore } from '@/stores/ui';
import { useExpandMedia } from '@/features/media-window';

export function CallBanner() {
  const { callState, peer, startedAt, answeredElsewhere, transferCall, dismissCall } = useCall();
  const mediaViewMode = useUiStore((s) => s.mediaViewMode);
  const expandMedia = useExpandMedia();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (callState !== 'active' || !startedAt) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [callState, startedAt]);

  if (answeredElsewhere && peer && callState !== 'idle' && callState !== 'ended') {
    return (
      <div className="flex items-center gap-3 bg-accent-subtle border border-accent/20 rounded-lg px-4 py-2">
        <span className="text-sm text-secondary">
          Call with <span className="font-medium text-primary">{peer.display_name ?? peer.username}</span> active on another device
        </span>
        <Button size="sm" variant="primary" onClick={transferCall}>Transfer Here</Button>
        <Button size="sm" variant="ghost" onClick={dismissCall}>Dismiss</Button>
      </div>
    );
  }

  if (callState !== 'active' || !peer) return null;

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  const timeStr = `${m}:${s.toString().padStart(2, '0')}`;

  const isMinimized = mediaViewMode === 'floating' || mediaViewMode === 'snapped-left' || mediaViewMode === 'snapped-right';

  return (
    <div className="flex items-center gap-3 bg-accent-subtle border border-accent/20 rounded-lg px-4 py-2">
      <span className="text-sm text-secondary">
        In call with <span className="font-medium text-primary">{peer.display_name ?? peer.username}</span> &middot; {timeStr}
      </span>
      {isMinimized && (
        <IconButton
          size="sm"
          variant="ghost"
          tooltip="Return to call"
          onClick={expandMedia}
        >
          <Maximize2 className="size-3.5" />
        </IconButton>
      )}
    </div>
  );
}
