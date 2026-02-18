import { SmilePlus, Pin, PinOff, Pencil, Trash2 } from 'lucide-react';

import { IconButton, Tooltip } from '@/ui';

const QUICK_REACTIONS = [
  { emoji: '\u{1F44D}', label: 'Thumbs Up' },
  { emoji: '\u{1F44E}', label: 'Thumbs Down' },
  { emoji: '\u{1F602}', label: 'Laughing' },
  { emoji: '\u{2764}\u{FE0F}', label: 'Heart' },
  { emoji: '\u{1F440}', label: 'Eyes' },
];

type MessageToolbarProps = {
  isPinned: boolean;
  isOwn: boolean;
  reactOnly?: boolean;
  onReact: (emoji: string) => void;
  onPin: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function MessageToolbar({
  isPinned,
  isOwn,
  reactOnly,
  onReact,
  onPin,
  onEdit,
  onDelete,
}: MessageToolbarProps) {
  return (
    <div
      className="absolute -top-4 right-2 bg-surface border border-border rounded-lg shadow-lg p-1 flex gap-0.5 z-10 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity"
    >
      {QUICK_REACTIONS.map(({ emoji, label }) => (
        <Tooltip key={emoji} content={label}>
          <IconButton variant="ghost" size="sm" onClick={() => onReact(emoji)}>
            <span className="text-sm">{emoji}</span>
          </IconButton>
        </Tooltip>
      ))}
      <Tooltip content="Add Reaction">
        <IconButton variant="ghost" size="sm">
          <SmilePlus size={16} />
        </IconButton>
      </Tooltip>
      {!reactOnly && (
        <Tooltip content={isPinned ? 'Unpin' : 'Pin'}>
          <IconButton variant="ghost" size="sm" onClick={onPin}>
            {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
          </IconButton>
        </Tooltip>
      )}
      {isOwn && (
        <Tooltip content="Edit">
          <IconButton variant="ghost" size="sm" onClick={onEdit}>
            <Pencil size={16} />
          </IconButton>
        </Tooltip>
      )}
      {isOwn && (
        <Tooltip content="Delete">
          <IconButton variant="danger" size="sm" onClick={onDelete}>
            <Trash2 size={16} />
          </IconButton>
        </Tooltip>
      )}
    </div>
  );
}
