import { forwardRef } from 'react';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import { cn } from '@/lib/cn';

type SeparatorProps = SeparatorPrimitive.SeparatorProps & {
  className?: string;
};

export const Separator = forwardRef<HTMLDivElement, SeparatorProps>(
  ({ orientation = 'horizontal', className, ...props }, ref) => {
    return (
      <SeparatorPrimitive.Root
        ref={ref}
        orientation={orientation}
        decorative
        className={cn(
          'shrink-0 bg-border',
          orientation === 'horizontal' ? 'h-px w-full' : 'w-px h-full',
          className,
        )}
        {...props}
      />
    );
  },
);

Separator.displayName = 'Separator';
