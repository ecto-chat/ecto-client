import { type FormEvent } from 'react';

import { motion } from 'motion/react';

import { Button, Input } from '@/ui';

type AddressStageProps = {
  address: string;
  setAddress: (v: string) => void;
  error: string;
  loading: boolean;
  onSubmit: (e: FormEvent) => void;
};

export function AddressStage({ address, setAddress, error, loading, onSubmit }: AddressStageProps) {
  return (
    <motion.div
      key="address"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <div className="space-y-1">
        <h1 className="text-xl font-medium text-primary">Connect to a Server</h1>
        <p className="text-sm text-muted">Enter the address of the server you want to join.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <Input
          label="Server Address"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="example.com:3000"
          required
          autoFocus
        />

        <Button type="submit" loading={loading} disabled={!address.trim()} className="w-full">
          Connect
        </Button>
      </form>
    </motion.div>
  );
}
