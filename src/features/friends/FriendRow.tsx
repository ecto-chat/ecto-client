import { MessageCircle, Phone, UserMinus } from 'lucide-react';

import { Avatar, IconButton } from '@/ui';

import type { PresenceStatus } from 'ecto-shared';

type FriendRowProps = {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  status: PresenceStatus;
  onMessage: (userId: string) => void;
  onCall: (userId: string) => void;
  onRemove: (userId: string) => Promise<void>;
  isInCall?: boolean;
};

export function FriendRow({
  userId,
  username,
  avatarUrl,
  status,
  onMessage,
  onCall,
  onRemove,
  isInCall,
}: FriendRowProps) {
  return (
    <div className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-hover transition-colors cursor-pointer" onClick={() => onMessage(userId)}>
      <Avatar src={avatarUrl} username={username} size={40} status={status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary truncate">{username}</p>
        <p className="text-xs text-muted capitalize">{status}</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <IconButton
          variant="ghost"
          size="sm"
          tooltip="Message"
          onClick={() => onMessage(userId)}
        >
          <MessageCircle size={16} />
        </IconButton>
        <IconButton
          variant="ghost"
          size="sm"
          tooltip={isInCall ? 'Already in a call' : 'Call'}
          disabled={isInCall}
          onClick={() => onCall(userId)}
        >
          <Phone size={16} />
        </IconButton>
        <IconButton
          variant="danger"
          size="sm"
          tooltip="Remove"
          onClick={() => onRemove(userId)}
        >
          <UserMinus size={16} />
        </IconButton>
      </div>
    </div>
  );
}
