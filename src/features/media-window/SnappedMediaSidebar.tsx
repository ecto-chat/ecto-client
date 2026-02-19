import { motion } from 'motion/react';

import { useUiStore } from '@/stores/ui';
import { useVoiceStore } from '@/stores/voice';
import { springDock } from '@/lib/animations';

import { useMediaWindowMode } from './useMediaWindowMode';
import { SnappedHeader } from './SnappedHeader';
import { FloatingCallContent } from './FloatingCallContent';
import { FloatingVoiceContent } from './FloatingVoiceContent';
import { CompactControls } from './CompactControls';

export function SnappedMediaSidebar() {
  const mediaViewMode = useUiStore((s) => s.mediaViewMode);
  const width = useUiStore((s) => s.snappedSidebarWidth);
  const { mediaType, isActive, peer, channelName, participants, callStartedAt } = useMediaWindowMode();

  const isSnapped = mediaViewMode === 'snapped-left' || mediaViewMode === 'snapped-right';

  if (!isSnapped || !isActive || !mediaType) return null;

  const title = mediaType === 'call'
    ? peer?.display_name ?? peer?.username ?? 'Call'
    : channelName ?? 'Voice';

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={springDock}
      className="flex flex-col shrink-0 overflow-hidden border-border bg-secondary"
      style={{
        borderLeftWidth: mediaViewMode === 'snapped-right' ? 1 : 0,
        borderRightWidth: mediaViewMode === 'snapped-left' ? 1 : 0,
      }}
    >
      <SnappedHeader title={title} startedAt={callStartedAt} />
      <div className="flex flex-1 flex-col overflow-hidden bg-[rgba(12,12,20,0.95)]">
        {mediaType === 'call' ? (
          <FloatingCallContent />
        ) : (
          <FloatingVoiceContent participants={participants} />
        )}
      </div>
      <CompactControls mediaType={mediaType} />
    </motion.div>
  );
}
