import { useState, type FormEvent } from 'react';

import { Button, Input } from '@/ui';

import { ServerPreviewCard } from './ServerPreviewCard';
import type { ServerPreviewData } from './types';

type ServerPasswordPromptProps = {
  preview: ServerPreviewData | null;
  detectedUsername: string;
  error: string;
  onSubmit: (password: string) => void;
  onCancel: () => void;
};

export function ServerPasswordPrompt({
  preview,
  detectedUsername,
  error,
  onSubmit,
  onCancel,
}: ServerPasswordPromptProps) {
  const [passwordInput, setPasswordInput] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!passwordInput) return;
    onSubmit(passwordInput);
  };

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

      <p className="text-xs text-muted">
        Joining as <span className="text-primary">{detectedUsername}</span>. Enter your password to continue.
      </p>

      <Input
        label="Password"
        type="password"
        value={passwordInput}
        onChange={(e) => setPasswordInput(e.target.value)}
        placeholder="Enter your password"
        required
        autoFocus
        error={error || undefined}
      />

      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!passwordInput}>
          Join Server
        </Button>
      </div>
    </form>
  );
}
