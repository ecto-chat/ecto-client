import { useState, useMemo, useCallback, useRef, useEffect } from 'react';

import {
  DndContext,
  closestCenter,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type CollisionDetection,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Plus, FolderPlus } from 'lucide-react';

import { Button, ConfirmDialog } from '@/ui';

import { useChannelStore } from '@/stores/channel';

import { connectionManager } from '@/services/connection-manager';

import type { Channel } from 'ecto-shared';

import { SortableChannelRow } from './ChannelRow';
import { CreateChannelForm, CreateCategoryForm } from './ChannelForm';
import { SortableCategorySection } from './CategorySection';

type DeleteTarget = { type: 'channel' | 'category'; id: string; name: string; hasChildren?: boolean } | null;

const UNCAT = 'uncategorized';

/** Droppable zone for a channel container (accepts channel drops into empty areas) */
function DroppableContainer({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: 'container' } });
  return (
    <div ref={setNodeRef} className={`min-h-6 rounded transition-colors ${isOver ? 'bg-accent/10' : ''}`}>
      {children}
    </div>
  );
}

export function ChannelEditor({ serverId }: { serverId: string }) {
  const channelsMap = useChannelStore((s) => s.channels.get(serverId));
  const categoriesMap = useChannelStore((s) => s.categories.get(serverId));
  const allChannels = useMemo(() => channelsMap ? [...channelsMap.values()] : [], [channelsMap]);
  const categories = useMemo(
    () => categoriesMap ? [...categoriesMap.values()].sort((a, b) => a.position - b.position) : [],
    [categoriesMap],
  );

  const [editing, setEditing] = useState<Channel | null>(null);
  const [editName, setEditName] = useState('');
  const [editTopic, setEditTopic] = useState('');
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  // Channel containers: containerId → ordered channel IDs
  const [containers, setContainers] = useState<Record<string, string[]>>({});
  const isDragging = useRef(false);

  const buildContainers = useCallback(() => {
    const result: Record<string, string[]> = {};
    result[UNCAT] = allChannels
      .filter((ch) => !ch.category_id)
      .sort((a, b) => a.position - b.position)
      .map((ch) => ch.id);
    for (const cat of categories) {
      result[cat.id] = allChannels
        .filter((ch) => ch.category_id === cat.id)
        .sort((a, b) => a.position - b.position)
        .map((ch) => ch.id);
    }
    return result;
  }, [allChannels, categories]);

  // Sync from store when not dragging
  useEffect(() => {
    if (!isDragging.current) setContainers(buildContainers());
  }, [buildContainers]);

  // Channel lookup by ID
  const channelById = useMemo(() => {
    const map = new Map<string, Channel>();
    for (const ch of allChannels) map.set(ch.id, ch);
    return map;
  }, [allChannels]);

  // Category IDs set for quick lookup
  const categoryIdSet = useMemo(() => new Set(categories.map((c) => c.id)), [categories]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const startEdit = (ch: Channel) => { setEditing(ch); setEditName(ch.name); setEditTopic(ch.topic ?? ''); setError(''); };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setError('');
    try {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) throw new Error('Not connected');
      const updated = await trpc.channels.update.mutate({ channel_id: editing.id, name: editName, topic: editTopic || undefined });
      useChannelStore.getState().updateChannel(serverId, updated);
      setEditing(null);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to update channel'); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) throw new Error('Not connected');
      if (deleteTarget.type === 'channel') {
        await trpc.channels.delete.mutate({ channel_id: deleteTarget.id });
        useChannelStore.getState().removeChannel(serverId, deleteTarget.id);
        if (editing?.id === deleteTarget.id) setEditing(null);
      } else {
        await trpc.categories.delete.mutate({ category_id: deleteTarget.id });
      }
    } catch { /* silent */ } finally { setDeleteTarget(null); }
  };

  const rowProps = (ch: Channel) => ({
    channel: ch, isEditing: editing?.id === ch.id, editName, editTopic,
    onEditNameChange: setEditName, onEditTopicChange: setEditTopic,
    onStartEdit: () => startEdit(ch), onSave: handleSaveEdit, onCancel: () => setEditing(null),
    onDelete: () => setDeleteTarget({ type: 'channel', id: ch.id, name: ch.name }),
  });

  // ── Helpers ──

  const findChannelContainer = useCallback((id: UniqueIdentifier): string | undefined => {
    for (const [containerId, items] of Object.entries(containers)) {
      if (items.includes(id as string)) return containerId;
    }
    return undefined;
  }, [containers]);

  const isCategory = useCallback((id: UniqueIdentifier) => categoryIdSet.has(id as string), [categoryIdSet]);

  // ── Custom collision detection ──
  // When dragging a channel: only collide with other channels and container droppables
  // When dragging a category: only collide with other categories
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const activeData = args.active.data.current;

    if (activeData?.sortable && isCategory(args.active.id)) {
      // Dragging a category — only consider other category sortables
      const catContainers = args.droppableContainers.filter((c) => isCategory(c.id));
      return closestCenter({ ...args, droppableContainers: catContainers });
    }

    // Dragging a channel — exclude category sortables
    const nonCatContainers = args.droppableContainers.filter((c) => !isCategory(c.id));
    const centerHits = closestCenter({ ...args, droppableContainers: nonCatContainers });
    if (centerHits.length > 0) return centerHits;
    // Fall back to pointer-within for empty container droppables
    return pointerWithin({ ...args, droppableContainers: nonCatContainers });
  }, [isCategory]);

  // ── Drag handlers ──

  const handleDragStart = useCallback((event: DragStartEvent) => {
    isDragging.current = true;
    setActiveId(event.active.id);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || isCategory(active.id)) return; // Only handle channel cross-container moves

    const activeContainer = findChannelContainer(active.id);
    if (!activeContainer) return;

    // Determine which container `over` belongs to
    let overContainer: string | undefined;
    if (over.data.current?.type === 'container') {
      // Dropped on a droppable container — resolve actual container ID
      overContainer = (over.data.current.containerId as string | undefined) ?? (over.id as string);
    } else {
      overContainer = findChannelContainer(over.id);
    }
    if (!overContainer || activeContainer === overContainer) return;

    setContainers((prev) => {
      const source = [...(prev[activeContainer] ?? [])];
      const dest = [...(prev[overContainer] ?? [])];
      const activeIdx = source.indexOf(active.id as string);
      if (activeIdx === -1) return prev;

      source.splice(activeIdx, 1);

      const overIdx = dest.indexOf(over.id as string);
      if (overIdx >= 0) {
        dest.splice(overIdx, 0, active.id as string);
      } else {
        dest.push(active.id as string);
      }

      return { ...prev, [activeContainer]: source, [overContainer]: dest };
    });
  }, [findChannelContainer, isCategory]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    isDragging.current = false;
    setActiveId(null);

    if (!over) {
      setContainers(buildContainers());
      return;
    }

    // ── Category reorder ──
    if (isCategory(active.id) && isCategory(over.id) && active.id !== over.id) {
      const oldIdx = categories.findIndex((c) => c.id === active.id);
      const newIdx = categories.findIndex((c) => c.id === over.id);
      if (oldIdx !== -1 && newIdx !== -1) {
        const reordered = arrayMove(categories, oldIdx, newIdx);
        const payload = reordered.map((c, i) => ({ category_id: c.id, position: i }));
        for (const p of payload) useChannelStore.getState().updateCategory(serverId, { id: p.category_id, position: p.position });
        connectionManager.getServerTrpc(serverId)?.categories.reorder.mutate({ categories: payload }).catch(() => {});
      }
      return;
    }

    // ── Channel same-container reorder ──
    if (!isCategory(active.id)) {
      const activeContainer = findChannelContainer(active.id);
      const overContainer = over.data.current?.type === 'container'
        ? ((over.data.current.containerId as string | undefined) ?? (over.id as string))
        : findChannelContainer(over.id);

      if (activeContainer && overContainer && activeContainer === overContainer && active.id !== over.id) {
        setContainers((prev) => {
          const list = [...(prev[activeContainer] ?? [])];
          const oldIdx = list.indexOf(active.id as string);
          const newIdx = list.indexOf(over.id as string);
          if (oldIdx === -1 || newIdx === -1) return prev;
          return { ...prev, [activeContainer]: arrayMove(list, oldIdx, newIdx) };
        });
      }

      // Persist channel positions + category assignments
      queueMicrotask(() => {
        setContainers((current) => {
          const payload: Array<{ channel_id: string; position: number; category_id: string | null }> = [];
          for (const [containerId, channelIds] of Object.entries(current)) {
            for (let i = 0; i < channelIds.length; i++) {
              payload.push({
                channel_id: channelIds[i]!,
                position: i,
                category_id: containerId === UNCAT ? null : containerId,
              });
            }
          }
          for (const p of payload) {
            useChannelStore.getState().updateChannel(serverId, {
              id: p.channel_id,
              position: p.position,
              category_id: p.category_id,
            });
          }
          connectionManager.getServerTrpc(serverId)?.channels.reorder.mutate({ channels: payload }).catch(() => {});
          return current;
        });
      });
    }
  }, [isCategory, findChannelContainer, buildContainers, categories, serverId]);

  const uncatItems = containers[UNCAT] ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium text-primary">Channels</h3>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => { setShowCreateCategory(true); setShowCreateChannel(false); }}>
            <FolderPlus size={14} /> Category
          </Button>
          <Button size="sm" onClick={() => { setShowCreateChannel(true); setShowCreateCategory(false); }}>
            <Plus size={14} /> Channel
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {showCreateChannel && <CreateChannelForm serverId={serverId} categories={categories} onDone={() => setShowCreateChannel(false)} />}
      {showCreateCategory && <CreateCategoryForm serverId={serverId} onDone={() => setShowCreateCategory(false)} />}

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Uncategorized channels */}
        <div className="mb-2">
          <h4 className="text-xs uppercase tracking-wider font-semibold text-muted mb-1.5">Uncategorized</h4>
          <DroppableContainer id={UNCAT}>
            <SortableContext items={uncatItems} strategy={verticalListSortingStrategy}>
              {uncatItems.map((chId) => {
                const ch = channelById.get(chId);
                return ch ? <SortableChannelRow key={chId} {...rowProps(ch)} /> : null;
              })}
              {uncatItems.length === 0 && (
                <p className="text-xs text-muted py-1 pl-3">Drop channels here</p>
              )}
            </SortableContext>
          </DroppableContainer>
        </div>

        {/* Categories (sortable for reordering + droppable for channel moves) */}
        <SortableContext items={categories.map((cat) => cat.id)} strategy={verticalListSortingStrategy}>
          {categories.map((cat) => {
            const catItems = containers[cat.id] ?? [];
            return (
              <SortableCategorySection
                key={cat.id}
                category={cat}
                channelIds={catItems}
                channelById={channelById}
                channelRowProps={rowProps}
                onDeleteCategory={() => setDeleteTarget({ type: 'category', id: cat.id, name: cat.name, hasChildren: catItems.length > 0 })}
              />
            );
          })}
        </SortableContext>
      </DndContext>

      <ConfirmDialog open={deleteTarget !== null} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title={deleteTarget?.type === 'channel' ? 'Delete Channel' : 'Delete Category'}
        description={deleteTarget?.type === 'category' && deleteTarget.hasChildren
          ? `"${deleteTarget.name}" has channels. Delete it anyway? Channels will become uncategorized.`
          : `Delete "${deleteTarget?.name ?? ''}"? This cannot be undone.`}
        variant="danger" confirmLabel="Delete" onConfirm={confirmDelete} />
    </div>
  );
}
