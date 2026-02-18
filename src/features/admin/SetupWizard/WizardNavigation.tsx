import { Button } from '@/ui';

import type { WizardStep } from './wizard-types';

type WizardNavigationProps = {
  step: WizardStep;
  loading: boolean;
  showBack: boolean;
  channelsCreated: boolean;
  hasInvite: boolean;
  onBack: () => void;
  onNext: () => void;
  onSaveIdentity: () => void;
  onSaveSettings: () => void;
  onCreateChannels: () => void;
};

export function WizardNavigation({
  step,
  loading,
  showBack,
  channelsCreated,
  hasInvite,
  onBack,
  onNext,
  onSaveIdentity,
  onSaveSettings,
  onCreateChannels,
}: WizardNavigationProps) {
  if (step === 5 || (step === 7 && hasInvite)) return null;

  return (
    <div className="flex items-center justify-between pt-2 border-t border-border">
      {showBack ? (
        <Button variant="ghost" onClick={onBack} disabled={loading}>
          Back
        </Button>
      ) : (
        <div />
      )}
      {step === 1 && <Button onClick={onNext}>Get Started</Button>}
      {step === 2 && <Button onClick={onNext}>Next</Button>}
      {step === 3 && (
        <Button onClick={onSaveIdentity} loading={loading}>
          Save & Continue
        </Button>
      )}
      {step === 4 && (
        <Button onClick={onSaveSettings} loading={loading}>
          Save & Continue
        </Button>
      )}
      {step === 6 && !channelsCreated && (
        <Button onClick={onCreateChannels} loading={loading}>
          Create Channels
        </Button>
      )}
      {step === 6 && channelsCreated && <Button onClick={onNext}>Next</Button>}
    </div>
  );
}
