import { useEffect, useRef, useCallback, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/ui/Tabs';

import { recordEmojiUsage, type EmojiItem } from '@/lib/emoji-data';

import { EmojiTab } from './EmojiTab';
import { GifTab } from './GifTab';

type EmojiGifPickerProps = {
  mode: 'both' | 'emoji-only';
  onEmojiSelect: (emoji: string) => void;
  onGifSelect?: (url: string) => void;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
};

export function EmojiGifPicker({ mode, onEmojiSelect, onGifSelect, onClose, anchorRef }: EmojiGifPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);

  // Compute position based on anchor
  const getPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return { top: 0, left: 0 };

    const rect = anchor.getBoundingClientRect();
    const pickerWidth = 352;
    const pickerHeight = 420;

    let left = rect.right - pickerWidth;
    let top = rect.top - pickerHeight - 8;

    // Clamp to viewport
    if (left < 8) left = 8;
    if (left + pickerWidth > window.innerWidth - 8) left = window.innerWidth - pickerWidth - 8;
    if (top < 8) {
      // Show below anchor instead
      top = rect.bottom + 8;
    }

    return { top, left };
  }, [anchorRef]);

  const pos = getPosition();

  // Click-outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (pickerRef.current && !pickerRef.current.contains(target)) {
        // Don't close if clicking the anchor button itself (toggle behavior)
        if (anchorRef.current?.contains(target)) return;
        onClose();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose, anchorRef]);

  // Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleEmojiSelect = useCallback(
    (emoji: string, item: EmojiItem) => {
      recordEmojiUsage(item);
      onEmojiSelect(emoji);
    },
    [onEmojiSelect],
  );

  const handleGifSelect = useCallback(
    (url: string) => {
      onGifSelect?.(url);
      onClose();
    },
    [onGifSelect, onClose],
  );

  return createPortal(
    <motion.div
      ref={pickerRef}
      initial={{ opacity: 0, scale: 0.95, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 4 }}
      transition={{ duration: 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="fixed z-50 bg-surface border-2 border-primary rounded-lg shadow-xl flex flex-col"
      style={{
        top: pos.top,
        left: pos.left,
        width: 352,
        height: 420,
      }}
    >
      {mode === 'both' ? (
        <Tabs defaultValue="emoji" className="flex flex-col h-full">
          <div className="px-2 pt-2">
            <TabsList className="w-full">
              <TabsTrigger value="emoji" className="flex-1">Emoji</TabsTrigger>
              <TabsTrigger value="gif" className="flex-1">GIF</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="emoji" className="flex-1 min-h-0 mt-2">
            <EmojiTab onSelect={handleEmojiSelect} />
          </TabsContent>
          <TabsContent value="gif" className="flex-1 min-h-0 mt-2">
            <GifTab onSelect={handleGifSelect} />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="flex flex-col h-full pt-2">
          <EmojiTab onSelect={handleEmojiSelect} />
        </div>
      )}
    </motion.div>,
    document.body,
  );
}
