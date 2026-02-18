import { forwardRef, type ComponentPropsWithRef } from 'react';
import { cn } from '@/lib/cn';

type InputProps = {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  inputSize?: 'sm' | 'md' | 'lg';
} & Omit<ComponentPropsWithRef<'input'>, 'size'>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, icon, inputSize = 'md', className, ...props }, ref) {
    const sizeClasses = {
      sm: 'h-8 text-xs px-2.5',
      md: 'h-10 text-sm px-3',
      lg: 'h-11 text-base px-3.5',
    };
    return (
      <div className="flex flex-col gap-2">
        {label && <label className="text-sm font-medium text-secondary">{label}</label>}
        <div className="relative">
          {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">{icon}</div>}
          <input
            ref={ref}
            className={cn(
              'w-full rounded-md bg-input border border-border text-primary placeholder:text-muted',
              'focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-border-active',
              'transition-colors duration-150',
              sizeClasses[inputSize],
              icon && 'pl-9',
              error && 'ring-1 ring-danger/40 border-danger/40',
              className,
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }
);
