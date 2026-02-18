import { Check } from 'lucide-react';

import { cn } from '@/lib/cn';

import { STEP_LABELS, type WizardStep } from './wizard-types';

type WizardProgressProps = {
  currentStep: WizardStep;
};

export function WizardProgress({ currentStep }: WizardProgressProps) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 pb-4">
      {STEP_LABELS.map((label, index) => {
        const stepNum = (index + 1) as WizardStep;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;

        return (
          <div key={stepNum} className="flex flex-col items-center gap-1.5">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs',
                'transition-colors duration-150',
                isCompleted && 'bg-accent text-inverse',
                isActive && 'bg-accent/20 text-accent ring-1 ring-accent/40',
                !isActive && !isCompleted && 'bg-tertiary text-muted',
              )}
            >
              {isCompleted ? <Check size={14} /> : stepNum}
            </div>
            <span
              className={cn(
                'text-2xs max-w-[64px] text-center leading-tight',
                isActive ? 'text-primary' : 'text-muted',
              )}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
