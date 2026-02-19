import { useCallback, useRef, useState } from 'react';

import { cn } from '@/lib/cn';
import { useUiStore } from '@/stores/ui';
import { SNAP_MIN_WIDTH, SNAP_MAX_WIDTH, RESIZE_HANDLE_WIDTH } from '@/lib/media-window-constants';

type ResizeHandleProps = {
  side: 'left' | 'right';
};

export function ResizeHandle({ side }: ResizeHandleProps) {
  const [isActive, setIsActive] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsActive(true);
    startX.current = e.clientX;
    startWidth.current = useUiStore.getState().snappedSidebarWidth;
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isActive) return;
    const delta = e.clientX - startX.current;
    // For left-snapped, dragging right increases width; for right-snapped, dragging left increases
    const newWidth = side === 'left'
      ? startWidth.current + delta
      : startWidth.current - delta;
    const clamped = Math.min(SNAP_MAX_WIDTH, Math.max(SNAP_MIN_WIDTH, newWidth));
    useUiStore.getState().setSnappedSidebarWidth(clamped);
  }, [isActive, side]);

  const handlePointerUp = useCallback(() => {
    setIsActive(false);
  }, []);

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ width: RESIZE_HANDLE_WIDTH }}
      className={cn(
        'group relative shrink-0 cursor-col-resize',
        'flex items-center justify-center',
      )}
    >
      <div
        className={cn(
          'h-full w-[2px] transition-colors duration-150',
          isActive ? 'bg-accent' : 'bg-transparent group-hover:bg-accent/50',
        )}
      />
    </div>
  );
}
