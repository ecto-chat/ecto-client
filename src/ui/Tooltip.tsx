import { type ReactNode } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/cn';

type TooltipProps = {
  content: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactNode;
  delayDuration?: number;
};

export function Tooltip({ content, side = 'top', children, delayDuration = 300 }: TooltipProps) {
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={4}
          className={cn(
            'z-[200] rounded-md bg-black/90 px-2.5 py-1.5 text-xs text-white backdrop-blur-sm',
            'animate-in fade-in-0 duration-100 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
            'data-[side=top]:slide-in-from-bottom-0.5 data-[side=bottom]:slide-in-from-top-0.5',
            'data-[side=left]:slide-in-from-right-0.5 data-[side=right]:slide-in-from-left-0.5',
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
