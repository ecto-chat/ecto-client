import type { ReactNode } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useServerStore, connectionManager, updateStoredServerPositions } from 'ecto-core';
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
    const store = useServerStore.getState();

    store.reorderServers(newOrder);

    // Update position values in the store + cache and persist to central
    const positionUpdates: Array<{ id: string; position: number }> = [];
    for (let i = 0; i < newOrder.length; i++) {
      store.updateServer(newOrder[i]!, { position: i });
      positionUpdates.push({ id: newOrder[i]!, position: i });
    }
    updateStoredServerPositions(positionUpdates).catch(() => {});
    const central = connectionManager.getCentralTrpc();
    if (central) {
      const payload = newOrder
        .map((id, idx) => {
          const s = store.servers.get(id);
          return s ? { server_address: s.server_address, position: idx } : null;
        })
        .filter((x): x is { server_address: string; position: number } => x !== null);
      central.servers.reorder.mutate({ servers: payload }).catch((err: unknown) => {
        console.warn('[central] Failed to persist server order:', err);
      });
    }
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
