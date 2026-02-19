import { useState, useCallback, useRef } from 'react';
import { useUiStore } from '@/stores/ui';
import { SNAP_EDGE_THRESHOLD } from '@/lib/media-window-constants';

type SnapSide = 'left' | 'right' | null;

type MediaDragResult = {
  isDragging: boolean;
  nearSnap: SnapSide;
  onDragStart: () => void;
  onDrag: (event: PointerEvent | MouseEvent | TouchEvent) => void;
  onDragEnd: () => void;
};

export function useMediaDrag(): MediaDragResult {
  const [isDragging, setIsDragging] = useState(false);
  const [nearSnap, setNearSnap] = useState<SnapSide>(null);
  const lastClientX = useRef(0);

  const onDragStart = useCallback(() => {
    setIsDragging(true);
    setNearSnap(null);
  }, []);

  const onDrag = useCallback((event: PointerEvent | MouseEvent | TouchEvent) => {
    let clientX: number;
    if ('clientX' in event) {
      clientX = event.clientX;
    } else if ('touches' in event && event.touches.length > 0) {
      clientX = event.touches[0]!.clientX;
    } else {
      return;
    }

    lastClientX.current = clientX;
    const viewportWidth = window.innerWidth;

    if (clientX <= SNAP_EDGE_THRESHOLD) {
      setNearSnap('left');
    } else if (clientX >= viewportWidth - SNAP_EDGE_THRESHOLD) {
      setNearSnap('right');
    } else {
      setNearSnap(null);
    }
  }, []);

  const onDragEnd = useCallback(() => {
    setIsDragging(false);
    const clientX = lastClientX.current;
    const viewportWidth = window.innerWidth;

    if (clientX <= SNAP_EDGE_THRESHOLD) {
      useUiStore.getState().setMediaViewMode('snapped-left');
    } else if (clientX >= viewportWidth - SNAP_EDGE_THRESHOLD) {
      useUiStore.getState().setMediaViewMode('snapped-right');
    }

    setNearSnap(null);
  }, []);

  return { isDragging, nearSnap, onDragStart, onDrag, onDragEnd };
}
