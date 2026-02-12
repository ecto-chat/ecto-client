import { useMemberStore } from '../../stores/member.js';
import { useUiStore } from '../../stores/ui.js';
import { useAuthStore } from '../../stores/auth.js';

interface TypingIndicatorProps {
  channelId: string;
  typingUsers: Map<string, number> | undefined;
}

export function TypingIndicator({ channelId, typingUsers }: TypingIndicatorProps) {
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
    text = `${names[0]} is typing...`;
  } else if (names.length === 2) {
    text = `${names[0]} and ${names[1]} are typing...`;
  } else if (names.length === 3) {
    text = `${names[0]}, ${names[1]}, and ${names[2]} are typing...`;
  } else {
    text = 'Several people are typing...';
  }

  return (
    <div className="typing-indicator">
      <span className="typing-dots">
        <span />
        <span />
        <span />
      </span>
      <span className="typing-text">{text}</span>
    </div>
  );
}
