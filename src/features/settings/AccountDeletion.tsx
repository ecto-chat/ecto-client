import { useState, type FormEvent } from 'react';

import { AlertTriangle } from 'lucide-react';

import { Button, Input, ConfirmDialog } from '@/ui';

import { useAuthStore } from '@/stores/auth';

import { connectionManager } from '@/services/connection-manager';

import { fullLogout } from '@/stores/reset';

export function AccountDeletion() {
  const user = useAuthStore((s) => s.user);

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isPendingDeletion = !!(user as Record<string, unknown> | null)?.deletion_scheduled_at;

  const handleDelete = async () => {
    setError('');
    setSuccess('');

    if (!password) {
      setError('Please enter your password to confirm.');
      return;
    }

    setLoading(true);
    try {
      const trpc = connectionManager.getCentralTrpc();
      if (!trpc) throw new Error('Not connected to central');

      await trpc.auth.deleteAccount.mutate({ password });
      setSuccess('Account scheduled for deletion. You have 30 days to cancel. You will now be logged out.');
      setPassword('');
      setConfirmOpen(false);
      setTimeout(() => { fullLogout().catch(() => {}); }, 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelDeletion = async () => {
    setError('');
    setSuccess('');
    setCancelLoading(true);
    try {
      const trpc = connectionManager.getCentralTrpc();
      if (!trpc) throw new Error('Not connected to central');
      await trpc.auth.cancelDeletion.mutate();
      setSuccess('Account deletion has been cancelled. Your account is safe.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel deletion');
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg text-danger">Delete Account</h2>

      {error && <p className="text-sm text-danger">{error}</p>}
      {success && <p className="text-sm text-success">{success}</p>}

      {isPendingDeletion ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
            <p className="text-sm text-secondary">
              Your account is currently scheduled for deletion. You can cancel the deletion within the 30-day grace period to keep your account.
            </p>
          </div>
          <Button loading={cancelLoading} onClick={handleCancelDeletion}>Cancel Deletion</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-danger" />
              <span className="text-sm text-primary">This action is irreversible after 30 days.</span>
            </div>
            <p className="text-sm text-secondary">Deleting your account will:</p>
            <ul className="text-sm text-secondary list-disc pl-5 space-y-1">
              <li>Remove your profile from the Ecto network</li>
              <li>Delete all your direct messages</li>
              <li>Remove your friend connections</li>
              <li>Remove your membership from all servers</li>
            </ul>
            <p className="text-sm text-secondary">
              You have a 30-day grace period to cancel the deletion by logging back in and reversing the action.
            </p>
          </div>

          <div className="space-y-3">
            <Input
              label="Confirm your password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Enter your password"
            />
            <Button variant="danger" disabled={!password} onClick={() => setConfirmOpen(true)}>
              Delete My Account
            </Button>
          </div>

          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Confirm Account Deletion"
            description="Are you sure you want to delete your account? This will schedule your account for permanent deletion after 30 days."
            confirmLabel="Permanently Delete Account"
            variant="danger"
            onConfirm={handleDelete}
            loading={loading}
          />
        </div>
      )}
    </div>
  );
}
