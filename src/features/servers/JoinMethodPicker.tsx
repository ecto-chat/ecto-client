import { useState, type FormEvent } from 'react';

import { Globe } from 'lucide-react';

import { Button, Input } from '@/ui';

type JoinMethodPickerProps = {
  onSubmit: (address: string) => Promise<void>;
  onCancel: () => void;
  error: string;
};

export function JoinMethodPicker({ onSubmit, onCancel, error }: JoinMethodPickerProps) {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(address);
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
        required
        autoFocus
        error={error || undefined}
        icon={<Globe size={16} />}
      />

      <p className="text-xs text-muted">
        Enter the address of the server you want to join, or paste an invite link.
      </p>

      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={loading} disabled={!address.trim()}>
          Join Server
        </Button>
      </div>
    </form>
  );
}
