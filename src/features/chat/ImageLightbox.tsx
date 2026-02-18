import { useCallback, useEffect } from 'react';

import * as Dialog from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download } from 'lucide-react';

import { IconButton } from '@/ui';

import { useUiStore } from '@/stores/ui';

type LightboxData = {
  src: string;
  alt?: string;
  type?: 'image' | 'video' | 'audio';
};

export function ImageLightbox() {
  const open = useUiStore((s) => s.activeModal === 'image-lightbox');
  const data = useUiStore((s) => s.modalData) as LightboxData | null;
  const close = useCallback(() => useUiStore.getState().closeModal(), []);

  const src = data?.src ?? '';
  const alt = data?.alt ?? '';
  const mediaType = data?.type ?? 'image';

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, close]);

  const handleDownload = useCallback(() => {
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = alt || 'image';
    a.click();
  }, [src, alt]);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={close}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild aria-describedby={undefined}>
              <motion.div
                className="fixed inset-0 z-[200] flex items-center justify-center p-8 cursor-pointer"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                onClick={close}
              >
                <VisuallyHidden><Dialog.Title>Media preview</Dialog.Title></VisuallyHidden>

                {/* Toolbar */}
                <div className="absolute top-4 right-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <IconButton
                    variant="ghost"
                    size="md"
                    tooltip="Download"
                    className="bg-black/50 text-white hover:bg-black/70"
                    onClick={handleDownload}
                  >
                    <Download size={18} />
                  </IconButton>
                  <IconButton
                    variant="ghost"
                    size="md"
                    tooltip="Close"
                    className="bg-black/50 text-white hover:bg-black/70"
                    onClick={close}
                  >
                    <X size={18} />
                  </IconButton>
                </div>

                {/* Media */}
                {mediaType === 'video' ? (
                  <video
                    src={src}
                    controls
                    autoPlay
                    className="max-h-full max-w-full rounded-lg shadow-2xl cursor-default"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <track kind="captions" />
                  </video>
                ) : mediaType === 'audio' ? (
                  <div
                    className="flex flex-col items-center gap-4 rounded-xl bg-secondary/90 p-8 shadow-2xl cursor-default"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-sm text-primary">{alt || 'Audio'}</p>
                    <audio src={src} controls autoPlay className="min-w-[320px]">
                      <track kind="captions" />
                    </audio>
                  </div>
                ) : (
                  <img
                    src={src}
                    alt={alt}
                    className="max-h-full max-w-full rounded-lg object-contain shadow-2xl cursor-default"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
