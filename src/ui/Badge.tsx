import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

const variantStyles = {
  default: 'bg-accent text-white',
  secondary: 'bg-tertiary text-secondary',
  danger: 'bg-danger text-white',
  success: 'bg-success text-white',
  outline: 'border-2 border-primary text-secondary bg-transparent',
} as const;

const sizeStyles = {
  sm: 'text-[10px] h-4 min-w-4 px-1',
  md: 'text-xs h-5 min-w-5 px-1.5',
} as const;

type BadgeProps = {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  children: ReactNode;
  className?: string;
};

export function Badge({
  variant = 'default',
  size = 'md',
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
    >
      {children}
    </span>
  );
}
