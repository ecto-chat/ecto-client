import { type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
};

const widthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-3xl',
};

export function Modal({ open, onOpenChange, title, description, children, width = 'md', className }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild {...(!description && { 'aria-describedby': undefined })}>
              <motion.div
                className={cn(
                  'fixed left-1/2 top-1/2 z-[100] w-[calc(100%-2rem)]',
                  'bg-secondary border-2 border-primary rounded-xl shadow-2xl',
                  'focus:outline-none',
                  widthClasses[width],
                  className,
                )}
                initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
                animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
                exit={{ opacity: 0, scale: 0.97, x: '-50%', y: '-50%', transition: { duration: 0.15, ease: 'easeOut' } }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              >
                {title ? (
                  <div className="flex items-center justify-between px-5 py-4 border-b-2 border-primary">
                    <div>
                      <Dialog.Title className="text-lg font-medium text-primary">{title}</Dialog.Title>
                      {description && <Dialog.Description className="text-sm text-muted mt-0.5">{description}</Dialog.Description>}
                    </div>
                    <Dialog.Close asChild>
                      <button className="rounded-md p-1 text-muted hover:text-secondary hover:bg-hover transition-colors" aria-label="Close">
                        <X size={18} />
                      </button>
                    </Dialog.Close>
                  </div>
                ) : (
                  <VisuallyHidden><Dialog.Title>Dialog</Dialog.Title></VisuallyHidden>
                )}
                <div className="p-5">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
