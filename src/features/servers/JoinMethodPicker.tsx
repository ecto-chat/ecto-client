import { useState, type FormEvent } from 'react';

import { AnimatePresence, motion } from 'motion/react';
import { Globe, Ticket } from 'lucide-react';

import { Button, Input } from '@/ui';

type JoinMethodPickerProps = {
  onSubmit: (address: string) => Promise<void>;
  onCancel: () => void;
  error: string;
  needsInvite: boolean;
  onInviteSubmit: (inviteCode: string) => Promise<void>;
  initialAddress?: string;
};

export function JoinMethodPicker({ onSubmit, onCancel, error, needsInvite, onInviteSubmit, initialAddress = '' }: JoinMethodPickerProps) {
  const [address, setAddress] = useState(initialAddress);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (needsInvite) {
        await onInviteSubmit(inviteCode);
      } else {
        await onSubmit(address);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Server Address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="example.com:3000"
        required={!needsInvite}
        autoFocus={!needsInvite}
        disabled={needsInvite}
        error={!needsInvite ? error || undefined : undefined}
        icon={<Globe size={16} />}
      />

      <AnimatePresence>
        {needsInvite && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Input
              label="Invite Code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter invite code"
              required
              autoFocus
              error={error || undefined}
              icon={<Ticket size={16} />}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-xs text-muted">
        {needsInvite
          ? 'This server requires an invite code to join.'
          : 'Enter the address of the server you want to join, or paste an invite link.'}
      </p>

      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={loading} disabled={needsInvite ? !inviteCode.trim() : !address.trim()}>
          Join Server
        </Button>
      </div>
    </form>
  );
}
