import { useState, type FormEvent } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useChannelStore } from '../../stores/channel.js';
import { connectionManager } from '../../services/connection-manager.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import type { Channel, Category } from 'ecto-shared';

interface Props {
  serverId: string;
}

export function ChannelEditor({ serverId }: Props) {
  const channelsMap = useChannelStore((s) => s.channels.get(serverId));
  const categoriesMap = useChannelStore((s) => s.categories.get(serverId));

  const channels = channelsMap ? [...channelsMap.values()] : [];
  const categories = categoriesMap ? [...categoriesMap.values()].sort((a, b) => a.position - b.position) : [];

  const [editing, setEditing] = useState<Channel | null>(null);
  const [editName, setEditName] = useState('');
  const [editTopic, setEditTopic] = useState('');
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [error, setError] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Group channels by category
  const uncategorized = channels.filter((ch) => !ch.category_id).sort((a, b) => a.position - b.position);
  const byCategory = new Map<string, Channel[]>();
  for (const cat of categories) {
    byCategory.set(cat.id, channels.filter((ch) => ch.category_id === cat.id).sort((a, b) => a.position - b.position));
  }

  const startEdit = (channel: Channel) => {
    setEditing(channel);
    setEditName(channel.name);
    setEditTopic(channel.topic ?? '');
    setError('');
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setError('');
    try {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) throw new Error('Not connected');
      const updated = await trpc.channels.update.mutate({
        channel_id: editing.id,
        name: editName,
        topic: editTopic || undefined,
      });
      useChannelStore.getState().updateChannel(serverId, updated);
      setEditing(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update channel');
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (!window.confirm('Delete this channel? This cannot be undone.')) return;
    try {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) throw new Error('Not connected');
      await trpc.channels.delete.mutate({ channel_id: channelId });
      useChannelStore.getState().removeChannel(serverId, channelId);
      if (editing?.id === channelId) setEditing(null);
    } catch {
      // silent
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const catChannels = byCategory.get(categoryId) ?? [];
    if (catChannels.length > 0) {
      if (!window.confirm('This category has channels. Delete it anyway? Channels will become uncategorized.')) return;
    } else {
      if (!window.confirm('Delete this category?')) return;
    }
    try {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) throw new Error('Not connected');
      await trpc.categories.delete.mutate({ category_id: categoryId });
      // Reload categories from store (server will send WS events)
    } catch {
      // silent
    }
  };

  const handleChannelDragEnd = (event: DragEndEvent, channelList: Channel[], categoryId?: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = channelList.findIndex((ch) => ch.id === active.id);
    const newIndex = channelList.findIndex((ch) => ch.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(channelList, oldIndex, newIndex);
    const payload = reordered.map((ch, i) => ({
      channel_id: ch.id,
      position: i,
      ...(categoryId !== undefined ? { category_id: categoryId } : {}),
    }));

    // Optimistic update
    for (const item of payload) {
      useChannelStore.getState().updateChannel(serverId, { id: item.channel_id, position: item.position });
    }

    // Send to server
    const trpc = connectionManager.getServerTrpc(serverId);
    trpc?.channels.reorder.mutate({ channels: payload }).catch(() => {});
  };

  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((cat) => cat.id === active.id);
    const newIndex = categories.findIndex((cat) => cat.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(categories, oldIndex, newIndex);
    const payload = reordered.map((cat, i) => ({ category_id: cat.id, position: i }));

    // Optimistic update
    for (const item of payload) {
      useChannelStore.getState().updateCategory(serverId, { id: item.category_id, position: item.position });
    }

    const trpc = connectionManager.getServerTrpc(serverId);
    trpc?.categories.reorder.mutate({ categories: payload }).catch(() => {});
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: 'var(--text-primary, #fff)' }}>Channels</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setShowCreateCategory(true); setShowCreateChannel(false); }}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              border: 'none',
              borderRadius: 4,
              backgroundColor: 'var(--bg-tertiary, #202225)',
              color: 'var(--text-primary, #fff)',
              cursor: 'pointer',
            }}
          >
            + Category
          </button>
          <button
            onClick={() => { setShowCreateChannel(true); setShowCreateCategory(false); }}
            className="auth-button"
            style={{ fontSize: 13, padding: '6px 12px' }}
          >
            + Channel
          </button>
        </div>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}

      {/* Create forms */}
      {showCreateChannel && (
        <CreateChannelForm
          serverId={serverId}
          categories={categories}
          onDone={() => setShowCreateChannel(false)}
        />
      )}
      {showCreateCategory && (
        <CreateCategoryForm
          serverId={serverId}
          onDone={() => setShowCreateCategory(false)}
        />
      )}

      {/* Uncategorized channels */}
      {uncategorized.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted, #72767d)', marginBottom: 6 }}>
            Uncategorized
          </h4>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleChannelDragEnd(e, uncategorized)}>
            <SortableContext items={uncategorized.map((ch) => ch.id)} strategy={verticalListSortingStrategy}>
              {uncategorized.map((ch) => (
                <SortableChannelRow
                  key={ch.id}
                  channel={ch}
                  isEditing={editing?.id === ch.id}
                  editName={editName}
                  editTopic={editTopic}
                  onEditNameChange={setEditName}
                  onEditTopicChange={setEditTopic}
                  onStartEdit={() => startEdit(ch)}
                  onSave={handleSaveEdit}
                  onCancel={() => setEditing(null)}
                  onDelete={() => handleDeleteChannel(ch.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Categorized channels */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
        <SortableContext items={categories.map((cat) => cat.id)} strategy={verticalListSortingStrategy}>
          {categories.map((cat) => {
            const catChannels = byCategory.get(cat.id) ?? [];
            return (
              <SortableCategorySection
                key={cat.id}
                category={cat}
                catChannels={catChannels}
                editing={editing}
                editName={editName}
                editTopic={editTopic}
                sensors={sensors}
                onEditNameChange={setEditName}
                onEditTopicChange={setEditTopic}
                onStartEdit={startEdit}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={() => setEditing(null)}
                onDeleteChannel={handleDeleteChannel}
                onDeleteCategory={handleDeleteCategory}
                onChannelDragEnd={(e) => handleChannelDragEnd(e, catChannels, cat.id)}
              />
            );
          })}
        </SortableContext>
      </DndContext>
    </div>
  );
}

// ---------- Channel Row ----------

interface ChannelRowProps {
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
}

function SortableChannelRow(props: ChannelRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: props.channel.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ChannelRow {...props} dragAttributes={attributes} dragListeners={listeners} />
    </div>
  );
}

function ChannelRow({
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
}: ChannelRowProps & { dragAttributes?: React.HTMLAttributes<HTMLElement>; dragListeners?: Record<string, Function> }) {
  if (isEditing) {
    return (
      <div style={{
        padding: '8px 12px',
        borderRadius: 4,
        backgroundColor: 'var(--bg-secondary, #2f3136)',
        marginBottom: 4,
      }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            type="text"
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            className="auth-input"
            style={{ flex: 1 }}
            placeholder="Channel name"
          />
        </div>
        <input
          type="text"
          value={editTopic}
          onChange={(e) => onEditTopicChange(e.target.value)}
          className="auth-input"
          style={{ width: '100%', marginBottom: 8 }}
          placeholder="Channel topic (optional)"
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '4px 12px',
              fontSize: 13,
              border: 'none',
              borderRadius: 4,
              backgroundColor: 'var(--bg-tertiary, #202225)',
              color: 'var(--text-primary, #fff)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="auth-button"
            style={{ fontSize: 13, padding: '4px 12px' }}
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        borderRadius: 4,
        backgroundColor: 'var(--bg-secondary, #2f3136)',
        marginBottom: 2,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          {...dragAttributes}
          {...dragListeners}
          style={{ cursor: 'grab', color: 'var(--text-muted, #72767d)', fontSize: 14, userSelect: 'none' }}
          title="Drag to reorder"
        >
          &#8942;&#8942;
        </span>
        <span style={{ color: 'var(--text-muted, #72767d)', fontSize: 16 }}>
          {channel.type === 'voice' ? '\u{1F50A}' : '#'}
        </span>
        <span style={{ color: 'var(--text-primary, #fff)', fontSize: 14 }}>{channel.name}</span>
        {channel.topic && (
          <span style={{ color: 'var(--text-muted, #72767d)', fontSize: 12, marginLeft: 4 }}>
            — {channel.topic}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={onStartEdit}
          style={{
            padding: '2px 8px',
            fontSize: 12,
            border: 'none',
            borderRadius: 4,
            backgroundColor: 'transparent',
            color: 'var(--text-secondary, #b9bbbe)',
            cursor: 'pointer',
          }}
          title="Edit channel"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          style={{
            padding: '2px 8px',
            fontSize: 12,
            border: 'none',
            borderRadius: 4,
            backgroundColor: 'transparent',
            color: '#ed4245',
            cursor: 'pointer',
          }}
          title="Delete channel"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ---------- Sortable Category Section ----------

function SortableCategorySection({
  category,
  catChannels,
  editing,
  editName,
  editTopic,
  sensors,
  onEditNameChange,
  onEditTopicChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDeleteChannel,
  onDeleteCategory,
  onChannelDragEnd,
}: {
  category: Category;
  catChannels: Channel[];
  editing: Channel | null;
  editName: string;
  editTopic: string;
  sensors: ReturnType<typeof useSensors>;
  onEditNameChange: (v: string) => void;
  onEditTopicChange: (v: string) => void;
  onStartEdit: (ch: Channel) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDeleteChannel: (id: string) => void;
  onDeleteCategory: (id: string) => void;
  onChannelDragEnd: (e: DragEndEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    marginBottom: 16,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span
          {...attributes}
          {...listeners}
          style={{ cursor: 'grab', color: 'var(--text-muted, #72767d)', fontSize: 14, userSelect: 'none' }}
          title="Drag to reorder category"
        >
          &#8942;&#8942;
        </span>
        <h4 style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted, #72767d)', margin: 0 }}>
          {category.name}
        </h4>
        <button
          onClick={() => onDeleteCategory(category.id)}
          style={{
            padding: '0 4px',
            fontSize: 12,
            border: 'none',
            background: 'none',
            color: 'var(--text-muted, #72767d)',
            cursor: 'pointer',
          }}
          title="Delete category"
        >
          &times;
        </button>
      </div>
      {catChannels.length === 0 && (
        <p style={{ color: 'var(--text-muted, #72767d)', fontSize: 13, paddingLeft: 12 }}>No channels</p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onChannelDragEnd}>
        <SortableContext items={catChannels.map((ch) => ch.id)} strategy={verticalListSortingStrategy}>
          {catChannels.map((ch) => (
            <SortableChannelRow
              key={ch.id}
              channel={ch}
              isEditing={editing?.id === ch.id}
              editName={editName}
              editTopic={editTopic}
              onEditNameChange={onEditNameChange}
              onEditTopicChange={onEditTopicChange}
              onStartEdit={() => onStartEdit(ch)}
              onSave={onSaveEdit}
              onCancel={onCancelEdit}
              onDelete={() => onDeleteChannel(ch.id)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

// ---------- Create Channel Form ----------

function CreateChannelForm({
  serverId,
  categories,
  onDone,
}: {
  serverId: string;
  categories: Category[];
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'text' | 'voice'>('text');
  const [categoryId, setCategoryId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    try {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) throw new Error('Not connected');
      const created = await trpc.channels.create.mutate({
        name: name.trim(),
        type,
        category_id: categoryId || undefined,
      });
      useChannelStore.getState().addChannel(serverId, created);
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create channel');
    } finally {
      setCreating(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        padding: 12,
        borderRadius: 4,
        backgroundColor: 'var(--bg-secondary, #2f3136)',
        marginBottom: 16,
      }}
    >
      {error && <div className="auth-error" style={{ marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Channel name"
          className="auth-input"
          style={{ flex: 1 }}
          required
          autoFocus
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'text' | 'voice')}
          className="auth-input"
          style={{ width: 100 }}
        >
          <option value="text">Text</option>
          <option value="voice">Voice</option>
        </select>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="auth-input"
          style={{ width: 140 }}
        >
          <option value="">No Category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onDone}
          style={{
            padding: '4px 12px',
            fontSize: 13,
            border: 'none',
            borderRadius: 4,
            backgroundColor: 'var(--bg-tertiary, #202225)',
            color: 'var(--text-primary, #fff)',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button type="submit" disabled={creating} className="auth-button" style={{ fontSize: 13, padding: '4px 12px' }}>
          {creating ? <LoadingSpinner size={14} /> : 'Create'}
        </button>
      </div>
    </form>
  );
}

// ---------- Create Category Form ----------

function CreateCategoryForm({
  serverId,
  onDone,
}: {
  serverId: string;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    try {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) throw new Error('Not connected');
      const created = await trpc.categories.create.mutate({ name: name.trim() });
      // Store will be updated via WS event or we add it manually
      useChannelStore.getState().setCategories(serverId, [
        ...(useChannelStore.getState().categories.get(serverId)?.values() ?? []),
        created,
      ]);
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create category');
    } finally {
      setCreating(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        padding: 12,
        borderRadius: 4,
        backgroundColor: 'var(--bg-secondary, #2f3136)',
        marginBottom: 16,
      }}
    >
      {error && <div className="auth-error" style={{ marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Category name"
          className="auth-input"
          style={{ flex: 1 }}
          required
          autoFocus
        />
        <button
          type="button"
          onClick={onDone}
          style={{
            padding: '4px 12px',
            fontSize: 13,
            border: 'none',
            borderRadius: 4,
            backgroundColor: 'var(--bg-tertiary, #202225)',
            color: 'var(--text-primary, #fff)',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button type="submit" disabled={creating} className="auth-button" style={{ fontSize: 13, padding: '4px 12px' }}>
          {creating ? <LoadingSpinner size={14} /> : 'Create'}
        </button>
      </div>
    </form>
  );
}
