import { Link, Copy, PartyPopper, Ticket } from 'lucide-react';

import { Button, Input, Spinner } from '@/ui';

import type { StepProps } from './wizard-types';

type CompletionStepProps = Pick<StepProps, 'state' | 'loading'> & {
  onCreateInvite: () => void;
  onCopyInvite: () => void;
  onFinish: () => void;
};

export function CompletionStep({
  state,
  loading,
  onCreateInvite,
  onCopyInvite,
  onFinish,
}: CompletionStepProps) {
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

  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
        <Link size={24} className="text-accent" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl text-primary">Create Your First Invite</h2>
        <p className="text-sm text-secondary leading-relaxed max-w-sm">
          Create an invite link so others can join your server. You can
          always create more invites later from the admin panel.
        </p>
      </div>
      <Button onClick={onCreateInvite} loading={loading} className="w-full">
        Generate Invite
      </Button>
    </div>
  );
}
