import { Link, Copy, PartyPopper, Ticket } from 'lucide-react';

import { Button, Input } from '@/ui';
import { isManagedAddress } from '@/lib/server-address';

import type { StepProps } from './wizard-types';

type CompletionStepProps = Pick<StepProps, 'state' | 'loading'> & {
  requireInvite: boolean;
  serverUrl: string | null;
  onCreateInvite: () => void;
  onCopyInvite: () => void;
  onFinish: () => void;
};

export function CompletionStep({
  state,
  loading,
  requireInvite,
  serverUrl,
  onCreateInvite,
  onCopyInvite,
  onFinish,
}: CompletionStepProps) {
  // State 3: Invite created — show invite code + URL
  if (state.invite) {
    return (
      <div className="flex flex-col items-center gap-6 py-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
          <PartyPopper size={24} className="text-accent" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl text-primary">Setup Complete!</h2>
          <p className="text-sm text-secondary leading-relaxed max-w-sm">
            Your server is ready. Share this invite link to let others join:
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-center gap-2 rounded-lg bg-tertiary px-4 py-3">
            <Ticket size={16} className="text-accent shrink-0" />
            <span className="text-sm text-primary font-mono">{state.invite.code}</span>
          </div>

          {state.inviteUrl && (
            <div className="flex items-center gap-2">
              <Input
                value={state.inviteUrl}
                readOnly
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                variant="secondary"
                size="md"
                onClick={onCopyInvite}
              >
                <Copy size={14} />
                Copy
              </Button>
            </div>
          )}
        </div>

        <Button onClick={onFinish} className="w-full">
          Close Setup Wizard
        </Button>
      </div>
    );
  }

  // State 1: Not invite-only — setup complete, show server URL
  const isManaged = isManagedAddress(serverUrl);
  if (!requireInvite) {
    return (
      <div className="flex flex-col items-center gap-6 py-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
          <PartyPopper size={24} className="text-accent" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl text-primary">Setup Complete!</h2>
          <p className="text-sm text-secondary leading-relaxed max-w-sm">
            {isManaged
              ? 'Your server is ready. Share an invite link to let others join.'
              : 'Your server is ready. Anyone can join using the server address below.'}
          </p>
        </div>

        {isManaged ? (
          <Button variant="secondary" onClick={onCreateInvite} loading={loading} className="w-full">
            <Link size={14} />
            Generate Invite Link
          </Button>
        ) : serverUrl ? (
          <div className="flex items-center gap-2 w-full">
            <Input
              value={serverUrl}
              readOnly
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                navigator.clipboard.writeText(serverUrl).catch(() => {});
              }}
            >
              <Copy size={14} />
              Copy
            </Button>
          </div>
        ) : null}

        <Button onClick={onFinish} className="w-full">
          Close Setup Wizard
        </Button>
      </div>
    );
  }

  // State 2: Invite-only, no invite yet — prompt to generate
  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
        <Link size={24} className="text-accent" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl text-primary">Invite Friends to Your Server</h2>
        <p className="text-sm text-secondary leading-relaxed max-w-sm">
          Your server requires an invite to join. Generate an invite link so others can find their way in.
        </p>
      </div>

      {serverUrl && !isManaged && (
        <div className="flex items-center gap-2 w-full">
          <Input
            value={serverUrl}
            readOnly
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              navigator.clipboard.writeText(serverUrl).catch(() => {});
            }}
          >
            <Copy size={14} />
            Copy
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2 w-full">
        <Button onClick={onCreateInvite} loading={loading} className="w-full">
          Generate Invite
        </Button>
        <Button variant="ghost" onClick={onFinish} className="w-full">
          I'll do it later
        </Button>
      </div>
    </div>
  );
}
