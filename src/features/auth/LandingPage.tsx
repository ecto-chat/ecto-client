import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Hexagon } from 'lucide-react';

import { Button } from '@/ui';

const stagger = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3 },
  }),
};

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-[420px] rounded-xl bg-secondary border border-border p-5 space-y-5"
      >
        <motion.div
          custom={0}
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="flex justify-center"
        >
          <Hexagon size={48} className="text-accent" />
        </motion.div>

        <motion.div custom={1} initial="hidden" animate="visible" variants={stagger} className="text-center space-y-1">
          <h1 className="text-xl font-medium text-primary">Welcome to Ecto</h1>
          <p className="text-sm text-muted">Your servers, your rules.</p>
        </motion.div>

        <motion.div custom={2} initial="hidden" animate="visible" variants={stagger} className="space-y-3">
          <Button className="w-full" onClick={() => navigate('/login')}>
            Sign in to Ecto Central
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => navigate('/direct-connect')}>
            Connect to a Server
          </Button>
        </motion.div>

        <motion.p custom={3} initial="hidden" animate="visible" variants={stagger} className="text-center text-sm text-muted">
          New to Ecto?{' '}
          <a
            href="/register"
            onClick={(e) => {
              e.preventDefault();
              navigate('/register');
            }}
            className="text-accent hover:underline"
          >
            Create an account
          </a>
        </motion.p>
      </motion.div>
    </div>
  );
}
