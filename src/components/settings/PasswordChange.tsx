import { useState, type FormEvent } from 'react';
import { connectionManager } from '../../services/connection-manager.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';

export function PasswordChange() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const validate = (): string | null => {
    if (newPassword.length < 8) {
      return 'New password must be at least 8 characters.';
    }
    if (newPassword !== confirmPassword) {
      return 'New passwords do not match.';
    }
    if (currentPassword === newPassword) {
      return 'New password must be different from current password.';
    }
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const trpc = connectionManager.getCentralTrpc();
      if (!trpc) throw new Error('Not connected to central');

      await trpc.auth.changePassword.mutate({
        current_password: currentPassword,
        new_password: newPassword,
      });

      setSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-section">
      <h2 className="settings-heading">Change Password</h2>

      <form onSubmit={handleSubmit} className="settings-form">
        {error && <div className="settings-error">{error}</div>}
        {success && <div className="settings-success">{success}</div>}

        <label className="settings-label">
          Current Password
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="settings-input"
          />
        </label>

        <label className="settings-label">
          New Password
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="settings-input"
          />
          <span className="settings-hint">Must be at least 8 characters</span>
        </label>

        <label className="settings-label">
          Confirm New Password
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="settings-input"
          />
        </label>

        <div className="settings-actions">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? <LoadingSpinner size={18} /> : 'Change Password'}
          </button>
        </div>
      </form>
    </div>
  );
}
