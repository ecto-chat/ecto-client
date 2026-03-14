import { useState, type FormEvent } from 'react';
import { FolderPlus } from 'lucide-react';

import { Button, Input, Select } from '@/ui';

import { useChannelStore, connectionManager } from 'ecto-core';

import { normalizeChannelName, type Category } from 'ecto-shared';

import { ChannelTypeSelector, type ChannelType } from './ChannelTypeSelector';

type CreateChannelFormProps = {
  serverId: string;
  categories: Category[];
  onDone: () => void;
  defaultCategoryId?: string;
};

export function CreateChannelForm({ serverId, categories, onDone, defaultCategoryId }: CreateChannelFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ChannelType>('text');
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? 'none');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const categoryOptions = [
    { value: 'none', label: 'No Category' },
    ...categories.map((cat) => ({ value: cat.id, label: cat.name })),
  ];

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
        category_id: categoryId === 'none' ? undefined : categoryId,
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
    <form onSubmit={handleSubmit} className="rounded-lg bg-secondary border-2 border-primary p-4 mb-4 space-y-4">
      <h4 className="text-sm font-medium text-primary">Create Channel</h4>

      {error && <p className="text-sm text-danger">{error}</p>}

      <ChannelTypeSelector value={type} onChange={setType} />

      <div className="space-y-3">
        <Input
          label="Channel Name"
          value={name}
          onChange={(e) => setName(normalizeChannelName(e.target.value))}
          placeholder="e.g., general-chat"
          required
          autoFocus
        />

        <Select
          label="Category"
          options={categoryOptions}
          value={categoryId}
          onValueChange={setCategoryId}
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="secondary" size="sm" type="button" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" type="submit" loading={creating}>
          Create Channel
        </Button>
      </div>
    </form>
  );
}

type CreateCategoryFormProps = {
  serverId: string;
  onDone: () => void;
};

export function CreateCategoryForm({ serverId, onDone }: CreateCategoryFormProps) {
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
    <form onSubmit={handleSubmit} className="rounded-lg bg-secondary border-2 border-primary p-4 mb-4 space-y-4">
      <div className="flex items-center gap-2">
        <FolderPlus size={18} className="text-secondary" />
        <h4 className="text-sm font-medium text-primary">Create Category</h4>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Input
        label="Category Name"
        value={name}
        onChange={(e) => setName(normalizeChannelName(e.target.value))}
        placeholder="e.g., general"
        required
        autoFocus
      />

      <div className="flex gap-2 justify-end">
        <Button variant="secondary" size="sm" type="button" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" type="submit" loading={creating}>
          Create Category
        </Button>
      </div>
    </form>
  );
}
