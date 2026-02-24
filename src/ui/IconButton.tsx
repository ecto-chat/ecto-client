import { forwardRef, type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { cn } from '@/lib/cn';

const variantStyles = {
  default: 'bg-tertiary text-secondary hover:bg-hover hover:text-primary',
  ghost: 'bg-transparent text-secondary hover:bg-hover hover:text-primary',
  danger: 'bg-transparent text-secondary hover:bg-danger-subtle hover:text-danger',
} as const;

const sizeStyles = {
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-11 h-11',
} as const;

type Variant = keyof typeof variantStyles;
type Size = keyof typeof sizeStyles;

type IconButtonProps = Omit<HTMLMotionProps<'button'>, 'children'> & {
  variant?: Variant;
  size?: Size;
  tooltip?: string;
  children?: ReactNode;
};

const IconButtonInner = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      variant = 'default',
      size = 'md',
      tooltip: _tooltip,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <motion.button
        ref={ref}
        whileTap={disabled ? undefined : { scale: 0.98 }}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center',
          'rounded-full',
          'transition-colors duration-150',
          variantStyles[variant],
          sizeStyles[size],
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        )}
        {...props}
      >
        {children}
      </motion.button>
    );
  },
);

IconButtonInner.displayName = 'IconButtonInner';

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ tooltip, ...props }, ref) => {
    if (!tooltip) {
      return <IconButtonInner ref={ref} {...props} />;
    }

    return (
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <IconButtonInner ref={ref} tooltip={tooltip} {...props} />
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={4}
            className={cn(
              'rounded-md px-2.5 py-1.5',
              'bg-surface border-2 border-primary',
              'text-xs font-medium text-primary',
              'shadow-xl',
              'animate-in fade-in-0 duration-100 data-[side=top]:slide-in-from-bottom-0.5 data-[side=bottom]:slide-in-from-top-0.5 data-[side=left]:slide-in-from-right-0.5 data-[side=right]:slide-in-from-left-0.5',
              'z-50',
            )}
          >
            {tooltip}
            <Tooltip.Arrow className="fill-surface" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  },
);

IconButton.displayName = 'IconButton';
