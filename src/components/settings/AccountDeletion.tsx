import { useState, type FormEvent } from 'react';
import { useAuthStore } from '../../stores/auth.js';
import { connectionManager } from '../../services/connection-manager.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';

export function AccountDeletion() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isPendingDeletion = !!(user as Record<string, unknown> | null)?.deletion_scheduled_at;

  const handleDelete = async (e: FormEvent) => {
    e.preventDefault();
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

      setSuccess(
        'Account scheduled for deletion. You have 30 days to cancel. You will now be logged out.',
      );
      setPassword('');
      setConfirmOpen(false);

      // Log out after a brief delay so the user can read the message
      setTimeout(() => {
        logout().catch(() => {});
      }, 4000);
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
    <div className="settings-section">
      <h2 className="settings-heading settings-heading-danger">Delete Account</h2>

      {error && <div className="settings-error">{error}</div>}
      {success && <div className="settings-success">{success}</div>}

      {isPendingDeletion ? (
        <div className="account-deletion-pending">
          <div className="settings-warning-box">
            <p>
              Your account is currently scheduled for deletion. You can cancel the deletion
              within the 30-day grace period to keep your account.
            </p>
          </div>
          <div className="settings-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={handleCancelDeletion}
              disabled={cancelLoading}
            >
              {cancelLoading ? <LoadingSpinner size={18} /> : 'Cancel Deletion'}
            </button>
          </div>
        </div>
      ) : (
        <div className="account-deletion-form">
          <div className="settings-warning-box settings-warning-danger">
            <p>
              <strong>This action is irreversible after 30 days.</strong> Deleting your account will:
            </p>
            <ul>
              <li>Remove your profile from the Ecto network</li>
              <li>Delete all your direct messages</li>
              <li>Remove your friend connections</li>
              <li>Remove your membership from all servers</li>
            </ul>
            <p>
              You have a <strong>30-day grace period</strong> to cancel the deletion by logging back
              in and reversing the action.
            </p>
          </div>

          {!confirmOpen ? (
            <div className="settings-actions">
              <button
                type="button"
                className="btn-danger"
                onClick={() => setConfirmOpen(true)}
              >
                Delete My Account
              </button>
            </div>
          ) : (
            <form onSubmit={handleDelete} className="settings-form">
              <label className="settings-label">
                Confirm your password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  autoFocus
                  placeholder="Enter your password"
                  className="settings-input"
                />
              </label>

              <div className="settings-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setConfirmOpen(false);
                    setPassword('');
                    setError('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-danger"
                  disabled={loading || !password}
                >
                  {loading ? <LoadingSpinner size={18} /> : 'Permanently Delete Account'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
