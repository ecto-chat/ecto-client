import { useState, type FormEvent } from 'react';

import { Button, Input } from '@/ui';
import { useAuthStore } from '@/stores/auth';
import { useServerStore } from '@/stores/server';
import { useUiStore } from '@/stores/ui';
import { connectionManager } from '@/services/connection-manager';

type CreateServerFormProps = {
  onCancel: () => void;
};

export function CreateServerForm({ onCancel }: CreateServerFormProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const ct = useAuthStore.getState().getCentralTrpc();
      if (!ct) {
        setError('Not signed in to Ecto');
        return;
      }

      const result = await ct.servers.create.mutate({ name: name.trim() });

      // Add to server store
      useServerStore.getState().addServer(result.server);

      // Connect to the new server
      const token = useAuthStore.getState().token;
      if (token) {
        await connectionManager.connectToServer(result.serverId, result.address, token, { openMainWs: true });
      }

      // Close modal and switch to the new server
      useUiStore.getState().closeModal();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create server');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Server Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="My Awesome Server"
        required
        autoFocus
        minLength={2}
        maxLength={100}
        error={error || undefined}
      />

      <p className="text-xs text-muted">
        Your server will be hosted on Ecto's infrastructure. You can customize it after creation.
      </p>

      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={loading} disabled={!name.trim() || name.trim().length < 2}>
          Create Server
        </Button>
      </div>
    </form>
  );
}
