import { forwardRef } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/cn';

type SwitchProps = {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
};

const SwitchControl = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, disabled, className }, ref) => (
    <SwitchPrimitive.Root
      ref={ref}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        'w-10 h-6 rounded-full bg-tertiary',
        'data-[state=checked]:bg-accent',
        'transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'block w-5 h-5 rounded-full bg-white shadow-sm',
          'translate-x-0.5 data-[state=checked]:translate-x-[18px]',
          'transition-transform',
        )}
      />
    </SwitchPrimitive.Root>
  ),
);

SwitchControl.displayName = 'SwitchControl';

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  className,
}: SwitchProps) {
  if (!label) {
    return (
      <SwitchControl
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={className}
      />
    );
  }

  return (
    <div className={cn('flex w-full items-center justify-between gap-4', className)}>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-primary">{label}</span>
        {description && (
          <span className="text-xs text-muted">{description}</span>
        )}
      </div>
      <SwitchControl
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}
