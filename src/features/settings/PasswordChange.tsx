import { useState, type FormEvent } from 'react';

import { Button, Input } from '@/ui';

import { connectionManager } from '@/services/connection-manager';
import { useAuthStore } from '@/stores/auth';
import { secureStorage } from '@/services/secure-storage';
import { getActiveUserId } from '@/services/account-registry';

export function PasswordChange() {
  const user = useAuthStore((s) => s.user);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (user && !user.has_password) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-medium text-primary">Change Password</h2>
        <p className="text-sm text-muted">
          Your account is linked to Google. Password login is not available.
        </p>
      </div>
    );
  }

  const validate = (): string | null => {
    if (newPassword.length < 8) return 'New password must be at least 8 characters.';
    if (newPassword !== confirmPassword) return 'New passwords do not match.';
    if (currentPassword === newPassword) return 'New password must be different from current password.';
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

      const result = await trpc.auth.changePassword.mutate({
        current_password: currentPassword,
        new_password: newPassword,
      }) as { success: boolean; access_token?: string; refresh_token?: string };

      // Store new tokens from changePassword response
      if (result.access_token && result.refresh_token) {
        const userId = getActiveUserId();
        if (userId) {
          await secureStorage.set(`auth:${userId}:access_token`, result.access_token);
          await secureStorage.set(`auth:${userId}:refresh_token`, result.refresh_token);
        }
        useAuthStore.setState({
          token: result.access_token,
          refreshToken_: result.refresh_token,
        });
      }

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
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-primary">Change Password</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-danger">{error}</p>}
        {success && <p className="text-sm text-success">{success}</p>}

        <Input
          label="Current Password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        <div>
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <span className="text-xs text-muted">Must be at least 8 characters</span>
        </div>

        <Input
          label="Confirm New Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
        />

        <Button type="submit" loading={loading}>Change Password</Button>
      </form>
    </div>
  );
}
