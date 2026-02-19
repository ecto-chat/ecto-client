import { useCallback, useRef } from 'react';
import { motion } from 'motion/react';

import { useUiStore } from '@/stores/ui';
import { floatIn, springDock } from '@/lib/animations';
import { FLOAT_WIDTH, FLOAT_HEIGHT } from '@/lib/media-window-constants';
import { useMediaDrag } from '@/hooks/useMediaDrag';

import { useMediaWindowMode } from './useMediaWindowMode';
import { useExpandMedia } from './useExpandMedia';
import { FloatingHeader } from './FloatingHeader';
import { FloatingCallContent } from './FloatingCallContent';
import { FloatingVoiceContent } from './FloatingVoiceContent';
import { CompactControls } from './CompactControls';
import { SnapIndicator } from './SnapIndicator';

export function FloatingMediaWindow() {
  const mediaViewMode = useUiStore((s) => s.mediaViewMode);
  const { mediaType, isActive, peer, channelName, participants } = useMediaWindowMode();
  const { isDragging, nearSnap, onDragStart, onDrag, onDragEnd } = useMediaDrag();
  const constraintsRef = useRef<HTMLDivElement>(null);
  const expandMedia = useExpandMedia();

  const handleDoubleClick = useCallback(() => {
    expandMedia();
  }, [expandMedia]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      expandMedia();
    }
  }, [expandMedia]);

  if (mediaViewMode !== 'floating' || !isActive || !mediaType) return null;

  const title = mediaType === 'call'
    ? peer?.display_name ?? peer?.username ?? 'Call'
    : channelName ?? 'Voice';

  return (
    <>
      <SnapIndicator side={isDragging ? nearSnap : null} />
      {/* Full-viewport constraint boundary */}
      <div ref={constraintsRef} className="fixed inset-2 z-[274] pointer-events-none" />
      <motion.div
        variants={floatIn}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={springDock}
        drag
        dragMomentum={false}
        dragElastic={0.1}
        dragConstraints={constraintsRef}
        onDragStart={onDragStart}
        onDrag={(_e, info) => {
          const syntheticEvent = { clientX: info.point.x } as PointerEvent;
          onDrag(syntheticEvent);
        }}
        onDragEnd={onDragEnd}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        style={{
          position: 'fixed',
          bottom: 80,
          right: 16,
          width: FLOAT_WIDTH,
          height: FLOAT_HEIGHT,
        }}
        className="z-[275] flex flex-col overflow-hidden rounded-xl bg-[rgba(12,12,20,0.95)] shadow-2xl backdrop-blur-sm border border-white/10 outline-none"
      >
        <FloatingHeader title={title} />
        {mediaType === 'call' ? (
          <FloatingCallContent />
        ) : (
          <FloatingVoiceContent participants={participants} />
        )}
        <CompactControls mediaType={mediaType} />
      </motion.div>
    </>
  );
}
