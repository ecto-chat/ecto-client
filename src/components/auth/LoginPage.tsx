import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Opens popup for Google OAuth - actual URL would come from central config
    const popup = window.open(
      `${useAuthStore.getState().centralUrl}/auth/google`,
      'google-login',
      'width=500,height=600',
    );
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'google-auth' && event.data.token) {
        useAuthStore.getState().loginGoogle(event.data.token as string).then(() => {
          navigate('/', { replace: true });
        }).catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Google login failed');
        });
        window.removeEventListener('message', onMessage);
        popup?.close();
      }
    };
    window.addEventListener('message', onMessage);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Welcome back!</h1>
        <p className="auth-subtitle">We're so excited to see you again!</p>

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

          <button type="submit" disabled={loading} className="auth-button">
            {loading ? <LoadingSpinner size={18} /> : 'Log In'}
          </button>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <button type="button" onClick={handleGoogleLogin} className="auth-button auth-button-google">
            Sign in with Google
          </button>
        </form>

        <p className="auth-footer">
          Need an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
