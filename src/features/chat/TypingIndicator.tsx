import { AnimatePresence, motion } from 'motion/react';

import { useMemberStore } from '@/stores/member';
import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';

type TypingIndicatorProps = {
  channelId: string;
  typingUsers: Map<string, number> | undefined;
};

export function TypingIndicator({ channelId: _channelId, typingUsers }: TypingIndicatorProps) {
  const activeServerId = useUiStore((s) => s.activeServerId);
  const members = useMemberStore((s) => (activeServerId ? s.members.get(activeServerId) : undefined));
  const currentUserId = useAuthStore((s) => s.user?.id);

  if (!typingUsers || typingUsers.size === 0) return null;

  // Filter out self and expired (already handled by clearExpiredTyping, but just in case)
  const now = Date.now();
  const activeTypers: string[] = [];
  for (const [userId, ts] of typingUsers) {
    if (userId !== currentUserId && now - ts < 8000) {
      activeTypers.push(userId);
    }
  }

  if (activeTypers.length === 0) return null;

  const names = activeTypers.map((id) => {
    const member = members?.get(id);
    return member?.display_name ?? member?.username ?? 'Someone';
  });

  let text: string;
  if (names.length === 1) {
    text = `${names[0]} is typing`;
  } else if (names.length === 2) {
    text = `${names[0]} and ${names[1]} are typing`;
  } else if (names.length === 3) {
    text = `${names[0]}, ${names[1]}, and ${names[2]} are typing`;
  } else {
    text = 'Several people are typing';
  }

  return (
    <AnimatePresence>
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
        <span>{text}</span>
      </motion.div>
    </AnimatePresence>
  );
}
