import { AnimatePresence, motion } from 'motion/react';

type DMTypingIndicatorProps = {
  username: string;
  isTyping: boolean;
};

export function DMTypingIndicator({ username, isTyping }: DMTypingIndicatorProps) {
  return (
    <AnimatePresence>
      {isTyping && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-2 px-3 py-1 text-xs text-muted"
        >
          <span className="flex items-center gap-0.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="inline-block size-1 rounded-full bg-text-muted"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </span>
          <span>{username} is typing</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
