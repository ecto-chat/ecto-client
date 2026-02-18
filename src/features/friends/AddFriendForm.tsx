import { useState, type FormEvent } from 'react';

import { Button, Input } from '@/ui';
import { connectionManager } from '@/services/connection-manager';

export function AddFriendForm() {
  const [tag, setTag] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tag.trim()) return;

    setStatus('sending');
    setError('');

    try {
      const centralTrpc = connectionManager.getCentralTrpc();
      if (!centralTrpc) throw new Error('Not connected');

      const parts = tag.trim().split('#');
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new Error('Invalid format. Use Username#0000');
      }
      const [username, discriminator] = parts as [string, string];

      await centralTrpc.friends.request.mutate({ username, discriminator });
      setStatus('success');
      setTag('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send request');
      setStatus('error');
    }
  };

  return (
    <div className="px-3 py-4">
      <h3 className="text-lg font-medium text-primary">Add Friend</h3>
      <p className="mt-1 text-sm text-muted">
        You can add a friend with their username and tag. It&apos;s cAsE sEnSiTiVe!
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex items-end gap-3">
        <div className="flex-1">
          <Input
            value={tag}
            onChange={(e) => { setTag(e.target.value); setStatus('idle'); }}
            placeholder="Username#0000"
            error={status === 'error' ? error : undefined}
          />
        </div>
        <Button
          type="submit"
          disabled={status === 'sending' || !tag.trim()}
          loading={status === 'sending'}
          className="shrink-0 whitespace-nowrap"
        >
          Send Friend Request
        </Button>
      </form>

      {status === 'success' && (
        <p className="mt-2 text-sm text-success">Friend request sent!</p>
      )}
    </div>
  );
}
