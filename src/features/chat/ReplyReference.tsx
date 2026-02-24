import { CornerDownRight } from 'lucide-react';
import { Avatar } from '@/ui';
import { useMessageStore } from '@/stores/message';
import { useDmStore } from '@/stores/dm';
import { useServerDmStore } from '@/stores/server-dm';

type ReplyReferenceProps = {
  replyTo: string;
  onJump?: (messageId: string) => void;
};

/** Look up a message by ID across all stores. */
function findMessage(id: string) {
  // Channel messages
  for (const channelMsgs of useMessageStore.getState().messages.values()) {
    const msg = channelMsgs.get(id);
    if (msg) return { author: msg.author, content: msg.content };
  }
  // Central DMs
  for (const userMsgs of useDmStore.getState().messages.values()) {
    const dm = userMsgs.get(id);
    if (dm) return { author: dm.sender, content: dm.content };
  }
  // Server DMs
  for (const convoMsgs of useServerDmStore.getState().messages.values()) {
    const sdm = convoMsgs.get(id);
    if (sdm) return { author: sdm.author, content: sdm.content };
  }
  return null;
}

export function ReplyReference({ replyTo, onJump }: ReplyReferenceProps) {
  const found = findMessage(replyTo);

  return (
    <button
      type="button"
      className="flex items-center gap-1.5 mb-0.5 cursor-pointer hover:opacity-80 transition-opacity"
      onClick={() => onJump?.(replyTo)}
    >
      <CornerDownRight size={14} className="text-muted shrink-0" />
      {found ? (
        <>
          <Avatar
            src={found.author?.avatar_url}
            username={found.author?.username ?? 'Unknown'}
            size={16}
          />
          <span className="text-xs font-medium text-accent">
            {found.author?.display_name ?? found.author?.username ?? 'Unknown'}
          </span>
          <span className="text-xs text-muted truncate max-w-[300px]">
            {found.content || 'Click to see attachment'}
          </span>
        </>
      ) : (
        <span className="text-xs text-muted italic">Click to see original message</span>
      )}
    </button>
  );
}
