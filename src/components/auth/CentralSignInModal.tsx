import { useState, type FormEvent } from 'react';
import { Modal } from '../common/Modal.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import { useUiStore } from '../../stores/ui.js';
import { useAuthStore } from '../../stores/auth.js';
import { connectionManager } from '../../services/connection-manager.js';

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
        // Register flow
        await useAuthStore.getState().register(email, password, username);
      }

      // Establish Central WS + tRPC mid-session
      const { centralUrl } = useAuthStore.getState();
      await connectionManager.initializeCentralMidSession(centralUrl, () => useAuthStore.getState().token);

      // Reset form and close
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
    <Modal open={open} onClose={close} title="Sign in to Ecto Central">
      <form onSubmit={handleSubmit} className="auth-form">
        {error && <div className="auth-error">{error}</div>}

        <label className="auth-label">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className="auth-input"
          />
        </label>

        {mode === 'register' && (
          <label className="auth-label">
            Username
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="auth-input"
            />
          </label>
        )}

        <label className="auth-label">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="auth-input"
          />
        </label>

        <div className="modal-actions">
          <button type="button" onClick={close} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="auth-button">
            {loading ? <LoadingSpinner size={18} /> : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </div>

        <p className="auth-footer" style={{ marginTop: 12, textAlign: 'center' }}>
          {mode === 'login' ? (
            <>
              Need an account?{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); switchMode(); }}>
                Create Account
              </a>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); switchMode(); }}>
                Sign In
              </a>
            </>
          )}
        </p>
      </form>
    </Modal>
  );
}
