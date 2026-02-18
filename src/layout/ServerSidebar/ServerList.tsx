import type { ReactNode } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useServerStore } from '@/stores/server';
import { ServerIcon } from './ServerIcon';
import type { ServerListEntry } from 'ecto-shared';

function SortableServerIcon({ children, id }: { children: ReactNode; id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

interface ServerListProps {
  serverOrder: string[];
  servers: Map<string, ServerListEntry>;
  activeServerId: string | null;
  onServerClick: (serverId: string) => void;
}

export function ServerList({ serverOrder, servers, activeServerId, onServerClick }: ServerListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = serverOrder.indexOf(active.id as string);
    const newIndex = serverOrder.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove([...serverOrder], oldIndex, newIndex);
    useServerStore.getState().reorderServers(newOrder);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={serverOrder} strategy={verticalListSortingStrategy}>
        {serverOrder.map((serverId) => {
          const server = servers.get(serverId);
          if (!server) return null;
          return (
            <SortableServerIcon key={serverId} id={serverId}>
              <ServerIcon
                serverId={serverId}
                server={server}
                isActive={activeServerId === serverId}
                onClick={onServerClick}
              />
            </SortableServerIcon>
          );
        })}
      </SortableContext>
    </DndContext>
  );
}
