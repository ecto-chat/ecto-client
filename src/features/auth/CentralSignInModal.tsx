import { useState, type FormEvent } from 'react';

import { Button, Input, Modal, Separator } from '@/ui';

import { useUiStore, useAuthStore, connectionManager } from 'ecto-core';

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
  const [tosAccepted, setTosAccepted] = useState(false);

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

  const handleGoogleLogin = () => {
    const { centralUrl } = useAuthStore.getState();
    const popup = window.open(
      `${centralUrl}/auth/google`,
      'google-login',
      'width=500,height=600',
    );
    const onMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'google-auth' && event.data.token) {
        window.removeEventListener('message', onMessage);
        popup?.close();
        setError('');
        setLoading(true);
        try {
          await useAuthStore.getState().signInToCentralFromModalGoogle(event.data.token as string);
          const { centralUrl: url } = useAuthStore.getState();
          await connectionManager.initializeCentralMidSession(url, () => useAuthStore.getState().token);
          close();
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Google login failed');
        } finally {
          setLoading(false);
        }
      }
    };
    window.addEventListener('message', onMessage);
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
    setTosAccepted(false);
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

        {mode === 'register' && (
          <label className="flex items-start gap-2 text-sm text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={tosAccepted}
              onChange={(e) => setTosAccepted(e.target.checked)}
              className="mt-0.5 accent-accent"
            />
            <span>
              I have read and agree to the{' '}
              <a href="https://ecto.chat/privacy" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Privacy Policy</a>
              {' '}and{' '}
              <a href="https://ecto.chat/terms" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Terms of Service</a>
            </span>
          </label>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} disabled={mode === 'register' && !tosAccepted}>
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted">or</span>
          <Separator className="flex-1" />
        </div>

        <Button type="button" variant="secondary" className="w-full" onClick={handleGoogleLogin} disabled={loading}>
          Sign in with Google
        </Button>

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
