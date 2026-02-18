import { useState, type FormEvent } from 'react';

import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';

import { Button, Input } from '@/ui';

import { useAuthStore } from '@/stores/auth';

const stagger = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3 },
  }),
};

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (username.length < 2 || username.length > 32) {
      setError('Username must be 2-32 characters');
      return;
    }

    setLoading(true);
    try {
      await register(email, password, username);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-[420px] rounded-xl bg-secondary border border-border p-5 space-y-5"
      >
        <motion.h1 custom={0} initial="hidden" animate="visible" variants={stagger} className="text-center text-xl font-medium text-primary">Create an account</motion.h1>

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
            label="Username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={2}
            maxLength={32}
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />

          <Button type="submit" loading={loading} className="w-full">
            Continue
          </Button>
        </motion.form>

        <motion.p custom={2} initial="hidden" animate="visible" variants={stagger} className="text-center text-sm text-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:underline">
            Log In
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
