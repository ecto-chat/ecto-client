import {
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';

import { IconButton, Tooltip } from '@/ui';

import type { Channel, Category } from 'ecto-shared';

import { SortableChannelRow } from './ChannelRow';

type SortableCategorySectionProps = {
  category: Category;
  channelIds: string[];
  channelById: Map<string, Channel>;
  channelRowProps: (ch: Channel) => React.ComponentProps<typeof SortableChannelRow>;
  onDeleteCategory: () => void;
};

export function SortableCategorySection({
  category,
  channelIds,
  channelById,
  channelRowProps,
  onDeleteCategory,
}: SortableCategorySectionProps) {
  // Sortable for category reordering
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
  } = useSortable({ id: category.id, data: { type: 'category' } });

  // Droppable for channel drops into this category (prefixed to avoid ID collision with sortable)
  const droppableId = `drop:${category.id}`;
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: droppableId,
    data: { type: 'container', containerId: category.id },
  });

  return (
    <div
      ref={setSortableRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="mb-4"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span {...attributes} {...listeners} className="cursor-grab text-muted">
          <GripVertical size={14} />
        </span>
        <h4 className="text-xs uppercase tracking-wider font-semibold text-muted">{category.name}</h4>
        <Tooltip content="Delete category">
          <IconButton variant="danger" size="sm" onClick={onDeleteCategory}>
            <X size={12} />
          </IconButton>
        </Tooltip>
      </div>
      <div
        ref={setDroppableRef}
        className={`min-h-6 rounded transition-colors ${isOver ? 'bg-accent/10' : ''}`}
      >
        <SortableContext items={channelIds} strategy={verticalListSortingStrategy}>
          {channelIds.map((chId) => {
            const ch = channelById.get(chId);
            return ch ? <SortableChannelRow key={chId} {...channelRowProps(ch)} /> : null;
          })}
          {channelIds.length === 0 && (
            <p className="text-xs text-muted py-1 pl-3">Drop channels here</p>
          )}
        </SortableContext>
      </div>
    </div>
  );
}
