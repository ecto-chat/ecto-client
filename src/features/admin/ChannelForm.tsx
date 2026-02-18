import { useState, type FormEvent } from 'react';

import { Button, Input, Select, Spinner } from '@/ui';

import { useChannelStore } from '@/stores/channel';

import { connectionManager } from '@/services/connection-manager';

import type { Category } from 'ecto-shared';

type CreateChannelFormProps = {
  serverId: string;
  categories: Category[];
  onDone: () => void;
};

export function CreateChannelForm({ serverId, categories, onDone }: CreateChannelFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState('text');
  const [categoryId, setCategoryId] = useState('none');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const typeOptions = [
    { value: 'text', label: 'Text' },
    { value: 'voice', label: 'Voice' },
    { value: 'page', label: 'Page' },
  ];

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
        type: type as 'text' | 'voice' | 'page',
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
    <form onSubmit={handleSubmit} className="rounded-md bg-secondary border border-border p-3 mb-4 space-y-2">
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Channel name"
            required
            autoFocus
          />
        </div>
        <Select options={typeOptions} value={type} onValueChange={setType} />
        <Select options={categoryOptions} value={categoryId} onValueChange={setCategoryId} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" size="sm" type="button" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" type="submit" loading={creating}>
          Create
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
    <form onSubmit={handleSubmit} className="rounded-md bg-secondary border border-border p-3 mb-4 space-y-2">
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            required
            autoFocus
          />
        </div>
        <Button variant="secondary" size="sm" type="button" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" type="submit" loading={creating}>
          Create
        </Button>
      </div>
    </form>
  );
}
