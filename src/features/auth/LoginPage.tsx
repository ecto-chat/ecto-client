import { useState, type FormEvent } from 'react';

import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';

import { Button, Input, Separator } from '@/ui';

import { useAuthStore } from '@/stores/auth';

const stagger = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3 },
  }),
};

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
    const popup = window.open(
      `${useAuthStore.getState().centralUrl}/auth/google`,
      'google-login',
      'width=500,height=600',
    );
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'google-auth' && event.data.token) {
        useAuthStore
          .getState()
          .loginGoogle(event.data.token as string)
          .then(() => navigate('/', { replace: true }))
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : 'Google login failed');
          });
        window.removeEventListener('message', onMessage);
        popup?.close();
      }
    };
    window.addEventListener('message', onMessage);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-[420px] rounded-xl bg-secondary border border-border p-5 space-y-5"
      >
        <motion.div custom={0} initial="hidden" animate="visible" variants={stagger} className="text-center space-y-1">
          <h1 className="text-xl font-medium text-primary">Welcome back!</h1>
          <p className="text-sm text-muted">We're so excited to see you again!</p>
        </motion.div>

        <motion.form custom={1} initial="hidden" animate="visible" variants={stagger} onSubmit={handleSubmit} className="space-y-4">
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

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button type="submit" loading={loading} className="w-full">
            Log In
          </Button>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted">or</span>
            <Separator className="flex-1" />
          </div>

          <Button type="button" variant="secondary" className="w-full" onClick={handleGoogleLogin}>
            Sign in with Google
          </Button>
        </motion.form>

        <motion.p custom={2} initial="hidden" animate="visible" variants={stagger} className="text-center text-sm text-muted">
          Need an account?{' '}
          <Link to="/register" className="text-accent hover:underline">
            Register
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
