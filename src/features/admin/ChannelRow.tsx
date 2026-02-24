import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Hash, Volume2, FileText, Pencil, Trash2 } from 'lucide-react';

import { Button, IconButton, Input, Tooltip } from '@/ui';

import type { Channel } from 'ecto-shared';

type ChannelRowProps = {
  channel: Channel;
  isEditing: boolean;
  editName: string;
  editTopic: string;
  onEditNameChange: (v: string) => void;
  onEditTopicChange: (v: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
};

export function SortableChannelRow(props: ChannelRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: props.channel.id });

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <ChannelRowInner {...props} dragAttributes={attributes} dragListeners={listeners} />
    </div>
  );
}

function ChannelRowInner({
  channel,
  isEditing,
  editName,
  editTopic,
  onEditNameChange,
  onEditTopicChange,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
  dragAttributes,
  dragListeners,
}: ChannelRowProps & {
  dragAttributes?: React.HTMLAttributes<HTMLElement>;
  dragListeners?: Record<string, Function>;
}) {
  if (isEditing) {
    return (
      <div className="rounded-md bg-secondary border-2 border-primary p-3 mb-1 space-y-2">
        <Input
          value={editName}
          onChange={(e) => onEditNameChange(e.target.value)}
          placeholder="Channel name"
        />
        <Input
          value={editTopic}
          onChange={(e) => onEditTopicChange(e.target.value)}
          placeholder="Channel topic (optional)"
        />
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={onSave}>Save</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-md bg-secondary border-2 border-primary px-3 py-1.5 mb-0.5 group">
      <div className="flex items-center gap-1.5">
        <span
          {...dragAttributes}
          {...dragListeners}
          className="cursor-grab text-muted"
        >
          <GripVertical size={14} />
        </span>
        <span className="text-muted">
          {channel.type === 'voice' ? <Volume2 size={16} /> : channel.type === 'page' ? <FileText size={16} /> : <Hash size={16} />}
        </span>
        <span className="text-sm text-primary">{channel.name}</span>
        {channel.topic && (
          <span className="text-xs text-muted ml-1">&mdash; {channel.topic}</span>
        )}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <Tooltip content="Edit channel">
          <IconButton variant="ghost" size="sm" onClick={onStartEdit}>
            <Pencil size={14} />
          </IconButton>
        </Tooltip>
        <Tooltip content="Delete channel">
          <IconButton variant="danger" size="sm" onClick={onDelete}>
            <Trash2 size={14} />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
}
