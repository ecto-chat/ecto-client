import { Lock } from 'lucide-react';

import { Button, EmptyState } from '@/ui';

import { useUiStore } from '@/stores/ui';

type CentralSignInPromptProps = {
  message?: string;
};

export function CentralSignInPrompt({ message }: CentralSignInPromptProps) {
  const handleSignIn = () => {
    useUiStore.getState().openModal('central-sign-in');
  };

  return (
    <EmptyState
      icon={<Lock />}
      title="Sign in to Ecto Central"
      description={message ?? 'Connect your Ecto account to access friends, DMs, and calls.'}
      action={
        <Button variant="primary" onClick={handleSignIn}>
          Sign in to Ecto Central
        </Button>
      }
    />
  );
}
