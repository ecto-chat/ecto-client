import { useState, type FormEvent } from 'react';

import { Ticket } from 'lucide-react';

import { Button, Input } from '@/ui';

import { ServerPreviewCard } from './ServerPreviewCard';
import type { ServerPreviewData } from './types';

type InviteCodeFormProps = {
  preview: ServerPreviewData | null;
  needsPassword: boolean;
  detectedUsername: string;
  error: string;
  onSubmit: (inviteCode: string, password?: string) => void;
  onCancel: () => void;
};

export function InviteCodeForm({
  preview,
  needsPassword,
  detectedUsername,
  error,
  onSubmit,
  onCancel,
}: InviteCodeFormProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    if (needsPassword && !passwordInput) return;
    onSubmit(inviteCode, needsPassword ? passwordInput : undefined);
  };

  const canSubmit = inviteCode.trim() && (!needsPassword || passwordInput);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {preview && (
        <ServerPreviewCard
          name={preview.name}
          iconUrl={preview.icon_url}
          memberCount={preview.member_count}
          onlineCount={preview.online_count}
        />
      )}

      <p className="text-xs text-muted">This server requires an invite code to join.</p>

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

      {needsPassword && (
        <Input
          label={`Password for ${detectedUsername}`}
          type="password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          placeholder="Enter your password"
          required
        />
      )}

      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          Join Server
        </Button>
      </div>
    </form>
  );
}
