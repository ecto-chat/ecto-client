import { useState, useEffect } from 'react';
import { Maximize2, PictureInPicture2 } from 'lucide-react';

import { IconButton } from '@/ui';
import { useUiStore } from '@/stores/ui';

import { useExpandMedia } from './useExpandMedia';

type SnappedHeaderProps = {
  title: string;
  startedAt: number | null;
};

export function SnappedHeader({ title, startedAt }: SnappedHeaderProps) {
  const expandMedia = useExpandMedia();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  const timeStr = startedAt ? `${m}:${s.toString().padStart(2, '0')}` : null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
      <span className="text-sm font-medium text-primary truncate flex-1">{title}</span>
      {timeStr && (
        <span className="text-xs text-muted">{timeStr}</span>
      )}
      <IconButton
        size="sm"
        variant="ghost"
        tooltip="Float"
        onClick={() => useUiStore.getState().setMediaViewMode('floating')}
      >
        <PictureInPicture2 className="size-3.5" />
      </IconButton>
      <IconButton
        size="sm"
        variant="ghost"
        tooltip="Expand"
        onClick={expandMedia}
      >
        <Maximize2 className="size-3.5" />
      </IconButton>
    </div>
  );
}
