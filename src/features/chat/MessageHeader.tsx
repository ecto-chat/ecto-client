import { Pin } from 'lucide-react';

import { Badge, Button } from '@/ui';

type MessageHeaderProps = {
  authorName: string;
  roleColor?: string;
  isBot: boolean;
  timestamp: string;
  isEdited: boolean;
  isPinned: boolean;
  onAuthorClick: () => void;
};

export function MessageHeader({
  authorName,
  roleColor,
  isBot,
  timestamp,
  isEdited,
  isPinned,
  onAuthorClick,
}: MessageHeaderProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-sm font-medium hover:underline p-0 h-auto text-primary"
        style={roleColor ? { color: roleColor } : undefined}
        onClick={onAuthorClick}
      >
        {authorName}
      </Button>
      {isBot && (
        <Badge variant="secondary" size="sm">
          BOT
        </Badge>
      )}
      <span className="text-xs text-muted">{timestamp}</span>
      {isEdited && <span className="text-xs text-muted">(edited)</span>}
      {isPinned && <Pin size={14} className="text-muted" />}
    </div>
  );
}
