import { type FormEvent } from 'react';

import { motion } from 'motion/react';

import { Button, Input } from '@/ui';

import type { AuthAction } from './DirectConnectForm';

type CredentialsStageProps = {
  authAction: AuthAction;
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  setupToken: string;
  setSetupToken: (v: string) => void;
  showSetupToken: boolean;
  error: string;
  loading: boolean;
  onSubmit: (e: FormEvent) => void;
};

export function CredentialsStage({
  authAction,
  username,
  setUsername,
  password,
  setPassword,
  setupToken,
  setSetupToken,
  showSetupToken,
  error,
  loading,
  onSubmit,
}: CredentialsStageProps) {
  return (
    <motion.div
      key="credentials"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <div className="space-y-1">
        <h1 className="text-xl font-medium text-primary">
          {authAction === 'register' ? 'Create Local Account' : 'Sign In'}
        </h1>
        <p className="text-sm text-muted">
          {authAction === 'register'
            ? 'Create a local account on this server.'
            : 'Sign in with your existing local account.'}
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <Input
          label="Username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter username"
          required
          autoFocus
        />

        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          required
        />

        {showSetupToken && (
          <Input
            label="Setup Token"
            type="text"
            value={setupToken}
            onChange={(e) => setSetupToken(e.target.value)}
            placeholder="Enter server setup token"
          />
        )}

        <Button
          type="submit"
          loading={loading}
          disabled={!username.trim() || !password.trim()}
          className="w-full"
        >
          {authAction === 'register' ? 'Create & Join' : 'Sign In'}
        </Button>
      </form>
    </motion.div>
  );
}
