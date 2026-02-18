import { type ReactNode, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  DndContext,
  DragOverlay,
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
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
  defaultAnimateLayoutChanges, type AnimateLayoutChanges,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Permissions } from 'ecto-shared';
import { ScrollArea } from '@/ui/ScrollArea';
import { useChannelStore } from '@/stores/channel';
import { useUiStore } from '@/stores/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { connectionManager } from '@/services/connection-manager';
import { CategoryGroup } from '../CategoryGroup';
import { ChannelItem } from '../ChannelItem';
import type { Channel, Category } from 'ecto-shared';

const UNCAT = 'uncategorized';

// Keep shift animations during drag, skip the drop settle animation
const skipDropAnimation: AnimateLayoutChanges = (args) =>
  args.wasDragging ? false : defaultAnimateLayoutChanges(args);

function SortableChannelItem({ children, id, activeId }: { children: ReactNode; id: string; activeId: UniqueIdentifier | null }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id,
    data: { type: 'channel' },
    animateLayoutChanges: skipDropAnimation,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: activeId === id ? 0 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function SortableCategoryGroup({
  id,
  children,
  containerChannelIds,
  activeId,
  ...groupProps
}: {
  id: string;
  children: ReactNode;
  containerChannelIds: string[];
  activeId: UniqueIdentifier | null;
  name: string;
  collapsed: boolean;
  onToggle: () => void;
  onSettingsClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id,
    data: { type: 'category' },
    animateLayoutChanges: skipDropAnimation,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: activeId === id ? 0 : 1,
  };

  // Droppable zone for receiving channel drops (uses `drop:` prefix to avoid ID collision)
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop:${id}`,
    data: { type: 'container', containerId: id },
  });

  return (
    <div ref={setNodeRef} style={style}>
      <CategoryGroup {...groupProps} dragHandleProps={{ ...attributes, ...listeners }}>
        <div
          ref={setDropRef}
          className={`min-h-4 rounded transition-colors ${isOver ? 'bg-accent/10' : ''}`}
        >
          <SortableContext items={containerChannelIds} strategy={verticalListSortingStrategy}>
            {children}
          </SortableContext>
        </div>
      </CategoryGroup>
    </div>
  );
}

/** Droppable zone for uncategorized channels */
function UncatDroppable({ children, channelIds }: { children: ReactNode; channelIds: string[] }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop:${UNCAT}`,
    data: { type: 'container', containerId: UNCAT },
  });
  return (
    <div ref={setNodeRef} className={`min-h-4 rounded transition-colors ${isOver ? 'bg-accent/10' : ''}`}>
      <SortableContext items={channelIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </div>
  );
}

interface ChannelListProps {
  uncategorized: Channel[];
  categories: Map<string, Category>;
  categorized: Map<string, Channel[]>;
  activeChannelId: string | null;
  collapsedCategories: Set<string>;
  onChannelClick: (channel: Channel) => void;
  onToggleCategory: (categoryId: string) => void;
  canReorder: boolean;
  serverId: string;
}

export function ChannelList({
  uncategorized,
  categories,
  categorized,
  activeChannelId,
  collapsedCategories,
  onChannelClick,
  onToggleCategory,
  canReorder,
  serverId,
}: ChannelListProps) {
  const { isAdmin, effectivePermissions } = usePermissions(serverId);
  const canManageChannels = isAdmin || (effectivePermissions & Permissions.MANAGE_CHANNELS) !== 0;

  const handleCategorySettings = useCallback((categoryId: string) => {
    useUiStore.getState().setChannelSettingsId(`cat:${categoryId}`);
  }, []);

  const allChannels = useMemo(() => {
    const all = [...uncategorized];
    for (const list of categorized.values()) all.push(...list);
    return all;
  }, [uncategorized, categorized]);

  const channelById = useMemo(() => {
    const map = new Map<string, Channel>();
    for (const ch of allChannels) map.set(ch.id, ch);
    return map;
  }, [allChannels]);

  const sortedCategories = useMemo(
    () => [...categories.entries()].sort(([, a], [, b]) => a.position - b.position),
    [categories],
  );

  const categoryIdSet = useMemo(() => new Set(categories.keys()), [categories]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // ── Container state for cross-container drag ──
  const [containers, setContainers] = useState<Record<string, string[]>>({});
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const isDragging = useRef(false);

  const buildContainers = useCallback(() => {
    const result: Record<string, string[]> = {};
    result[UNCAT] = uncategorized.map((ch) => ch.id);
    for (const [catId] of sortedCategories) {
      result[catId] = (categorized.get(catId) ?? []).map((ch) => ch.id);
    }
    return result;
  }, [uncategorized, sortedCategories, categorized]);

  useEffect(() => {
    if (!isDragging.current) setContainers(buildContainers());
  }, [buildContainers]);

  // ── Helpers ──

  const findChannelContainer = useCallback((id: UniqueIdentifier): string | undefined => {
    for (const [containerId, items] of Object.entries(containers)) {
      if (items.includes(id as string)) return containerId;
    }
    return undefined;
  }, [containers]);

  const isCategory = useCallback((id: UniqueIdentifier) => categoryIdSet.has(id as string), [categoryIdSet]);

  // ── Custom collision detection ──
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const activeData = args.active.data.current;

    if (activeData?.type === 'category') {
      const catContainers = args.droppableContainers.filter((c) => isCategory(c.id));
      return closestCenter({ ...args, droppableContainers: catContainers });
    }

    const nonCatContainers = args.droppableContainers.filter((c) => !isCategory(c.id));
    const centerHits = closestCenter({ ...args, droppableContainers: nonCatContainers });
    if (centerHits.length > 0) return centerHits;
    return pointerWithin({ ...args, droppableContainers: nonCatContainers });
  }, [isCategory]);

  // ── Drag handlers ──

  const handleDragStart = useCallback((event: DragStartEvent) => {
    isDragging.current = true;
    setActiveId(event.active.id);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || isCategory(active.id)) return;

    const activeContainer = findChannelContainer(active.id);
    if (!activeContainer) return;

    let overContainer: string | undefined;
    if (over.data.current?.type === 'container') {
      overContainer = over.data.current.containerId as string;
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
      const catList = sortedCategories.map(([, cat]) => cat);
      const oldIdx = catList.findIndex((c) => c.id === active.id);
      const newIdx = catList.findIndex((c) => c.id === over.id);
      if (oldIdx !== -1 && newIdx !== -1) {
        const reordered = arrayMove(catList, oldIdx, newIdx);
        const payload = reordered.map((c, i) => ({ category_id: c.id, position: i }));
        for (const p of payload) useChannelStore.getState().updateCategory(serverId, { id: p.category_id, position: p.position });
        connectionManager.getServerTrpc(serverId)?.categories.reorder.mutate({ categories: payload }).catch(() => {});
      }
      return;
    }

    // ── Channel reorder (same or cross-container) ──
    if (!isCategory(active.id)) {
      const activeContainer = findChannelContainer(active.id);
      const overContainer = over.data.current?.type === 'container'
        ? (over.data.current.containerId as string)
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
  }, [isCategory, findChannelContainer, buildContainers, sortedCategories, serverId]);

  const handleDragCancel = useCallback(() => {
    isDragging.current = false;
    setActiveId(null);
    setContainers(buildContainers());
  }, [buildContainers]);

  // ── Render ──

  let itemIndex = 0;
  const categoryIds = sortedCategories.map(([catId]) => catId);

  const renderChannelItem = (ch: Channel) => (
    <ChannelItem
      channel={ch}
      isActive={ch.id === activeChannelId}
      onClick={onChannelClick}
    />
  );

  // Overlay content for the item being dragged
  const activeChannel = activeId && !isCategory(activeId) ? channelById.get(activeId as string) : null;
  const activeCategoryEntry = activeId && isCategory(activeId)
    ? sortedCategories.find(([catId]) => catId === activeId)
    : null;

  if (!canReorder) {
    return (
      <ScrollArea className="flex-1" fadeEdges fadeHeight={40}>
        <div className="p-2 space-y-2">
          <AnimatePresence mode="popLayout">
            {uncategorized.map((ch) => {
              const delay = itemIndex++ * 0.04 + 0.02;
              return (
                <motion.div
                  key={ch.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1], delay }}
                >
                  {renderChannelItem(ch)}
                </motion.div>
              );
            })}
          </AnimatePresence>

          <AnimatePresence mode="popLayout">
            {sortedCategories.map(([catId, category]) => {
              const catChannels = categorized.get(catId) ?? [];
              const delay = itemIndex++ * 0.04 + 0.02;
              return (
                <motion.div
                  key={catId}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1], delay }}
                >
                  <CategoryGroup
                    name={category.name}
                    collapsed={collapsedCategories.has(catId)}
                    onToggle={() => onToggleCategory(catId)}
                    onSettingsClick={canManageChannels ? () => handleCategorySettings(catId) : undefined}
                  >
                    {catChannels.map((ch) => (
                      <div key={ch.id}>{renderChannelItem(ch)}</div>
                    ))}
                  </CategoryGroup>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </ScrollArea>
    );
  }

  // ── Reorderable mode ──

  const uncatItems = containers[UNCAT] ?? [];

  return (
    <ScrollArea className="flex-1" fadeEdges fadeHeight={40}>
      <div className="p-2 space-y-2">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {/* Uncategorized channels */}
          <UncatDroppable channelIds={uncatItems}>
            {uncatItems.map((chId) => {
              const ch = channelById.get(chId);
              return ch ? (
                <SortableChannelItem key={chId} id={chId} activeId={activeId}>
                  {renderChannelItem(ch)}
                </SortableChannelItem>
              ) : null;
            })}
          </UncatDroppable>

          {/* Categories (sortable + droppable containers) */}
          <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
            {sortedCategories.map(([catId, category]) => {
              const catItems = containers[catId] ?? [];
              return (
                <SortableCategoryGroup
                  key={catId}
                  id={catId}
                  name={category.name}
                  collapsed={collapsedCategories.has(catId)}
                  onToggle={() => onToggleCategory(catId)}
                  onSettingsClick={canManageChannels ? () => handleCategorySettings(catId) : undefined}
                  containerChannelIds={catItems}
                  activeId={activeId}
                >
                  {catItems.map((chId) => {
                    const ch = channelById.get(chId);
                    return ch ? (
                      <SortableChannelItem key={chId} id={chId} activeId={activeId}>
                        {renderChannelItem(ch)}
                      </SortableChannelItem>
                    ) : null;
                  })}
                </SortableCategoryGroup>
              );
            })}
          </SortableContext>

          {/* Free-floating overlay that follows the cursor */}
          <DragOverlay dropAnimation={null}>
            {activeChannel ? (
              <div className="rounded-md bg-tertiary shadow-lg opacity-90">
                {renderChannelItem(activeChannel)}
              </div>
            ) : activeCategoryEntry ? (
              <div className="rounded-md bg-tertiary shadow-lg opacity-90">
                <CategoryGroup
                  name={activeCategoryEntry[1].name}
                  collapsed={false}
                  onToggle={() => {}}
                >
                  {(containers[activeCategoryEntry[0]] ?? []).map((chId) => {
                    const ch = channelById.get(chId);
                    return ch ? <div key={chId}>{renderChannelItem(ch)}</div> : null;
                  })}
                </CategoryGroup>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </ScrollArea>
  );
}
