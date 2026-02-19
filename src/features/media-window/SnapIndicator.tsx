import { AnimatePresence, motion } from 'motion/react';

import { snapIndicator } from '@/lib/animations';

type SnapIndicatorProps = {
  side: 'left' | 'right' | null;
};

export function SnapIndicator({ side }: SnapIndicatorProps) {
  return (
    <AnimatePresence>
      {side && (
        <motion.div
          key={side}
          variants={snapIndicator}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.15 }}
          className={`fixed top-2 bottom-2 z-[270] w-[80px] rounded-2xl bg-accent/10 border-2 border-accent/30 ${
            side === 'left' ? 'left-2' : 'right-2'
          }`}
        />
      )}
    </AnimatePresence>
  );
}
