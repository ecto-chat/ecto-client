import { useState, type FormEvent } from 'react';

import { Button, Input, Modal } from '@/ui';

import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';

import { connectionManager } from '@/services/connection-manager';

type Mode = 'login' | 'register';

export function CentralSignInModal() {
  const open = useUiStore((s) => s.activeModal === 'central-sign-in');
  const close = () => useUiStore.getState().closeModal();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await useAuthStore.getState().signInToCentralFromModal(email, password);
      } else {
        await useAuthStore.getState().register(email, password, username);
      }

      const { centralUrl } = useAuthStore.getState();
      await connectionManager.initializeCentralMidSession(centralUrl, () => useAuthStore.getState().token);

      setEmail('');
      setPassword('');
      setUsername('');
      close();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
  };

  return (
    <Modal open={open} onOpenChange={(v) => { if (!v) close(); }} title="Sign in to Ecto Central">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />

        {mode === 'register' && (
          <Input
            label="Username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        )}

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
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>
        </div>

        <p className="text-center text-sm text-muted">
          {mode === 'login' ? (
            <>
              Need an account?{' '}
              <Button variant="ghost" size="sm" onClick={switchMode} className="text-accent hover:underline px-0 h-auto">
                Create Account
              </Button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <Button variant="ghost" size="sm" onClick={switchMode} className="text-accent hover:underline px-0 h-auto">
                Sign In
              </Button>
            </>
          )}
        </p>
      </form>
    </Modal>
  );
}
