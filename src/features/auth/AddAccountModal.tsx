import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, Input, Modal } from '@/ui';

import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';
import { useVoiceStore } from '@/stores/voice';
import { useCallStore } from '@/stores/call';
import { useNotifyStore } from '@/stores/notify';

import { connectionManager } from '@/services/connection-manager';
import { resetAllStores } from '@/stores/reset';
import { preferenceManager } from '@/services/preference-manager';
import { getAccountCount } from '@/services/account-registry';

export function AddAccountModal() {
  const open = useUiStore((s) => s.activeModal === 'add-account');
  const close = () => useUiStore.getState().closeModal();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (getAccountCount() >= 5) {
      setError('Maximum 5 accounts. Remove one to add another.');
      return;
    }

    setLoading(true);

    try {
      // Save current navigation state before switching
      const currentActiveServer = useUiStore.getState().activeServerId;
      if (currentActiveServer) {
        preferenceManager.setUser('last-active-server', currentActiveServer);
      }

      // Suspend voice/call
      useVoiceStore.getState().cleanup();
      useCallStore.getState().cleanup();

      // Disconnect current session
      connectionManager.disconnectAll();

      // Reset stores
      resetAllStores();

      // Log in as the new account — this updates registry + preferenceManager
      await useAuthStore.getState().login(email, password);

      // Hydrate stores for the new account
      useNotifyStore.getState().hydrateFromPreferences();
      useUiStore.getState().hydrateFromPreferences();

      // Initialize central connections for the new account
      const { centralUrl } = useAuthStore.getState();
      await connectionManager.initializeCentralMidSession(centralUrl, () => useAuthStore.getState().token);

      // Clean up form and close
      setEmail('');
      setPassword('');
      close();

      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={(v) => { if (!v) close(); }} title="Add Account">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <p className="text-sm text-muted">
          Sign in with another Ecto account. You can switch between accounts from the sidebar.
        </p>

        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />

        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Sign In
          </Button>
        </div>
      </form>
    </Modal>
  );
}
