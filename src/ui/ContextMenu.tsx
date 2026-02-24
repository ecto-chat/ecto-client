import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';
import { cn } from '@/lib/cn';

/* ─── Root ─────────────────────────────────────────────────────────── */

export const ContextMenu = ContextMenuPrimitive.Root;

/* ─── Trigger ──────────────────────────────────────────────────────── */

export const ContextMenuTrigger = ContextMenuPrimitive.Trigger;

/* ─── Content ──────────────────────────────────────────────────────── */

type ContextMenuContentProps = ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>;

export const ContextMenuContent = forwardRef<
  ElementRef<typeof ContextMenuPrimitive.Content>,
  ContextMenuContentProps
>(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content
      ref={ref}
      className={cn(
        'z-[150] min-w-[8rem] overflow-hidden rounded-lg bg-surface border-2 border-primary shadow-xl p-1',
        'animate-in fade-in-0 zoom-in-95 duration-100',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        className,
      )}
      {...props}
    >
      {children}
    </ContextMenuPrimitive.Content>
  </ContextMenuPrimitive.Portal>
));

ContextMenuContent.displayName = 'ContextMenuContent';

/* ─── Item ─────────────────────────────────────────────────────────── */

type ContextMenuItemProps = ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
  danger?: boolean;
};

export const ContextMenuItem = forwardRef<
  ElementRef<typeof ContextMenuPrimitive.Item>,
  ContextMenuItemProps
>(({ className, danger = false, ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none transition-colors',
      danger
        ? 'text-red-400 hover:bg-danger-subtle focus:bg-danger-subtle'
        : 'text-secondary hover:bg-hover hover:text-primary focus:bg-hover focus:text-primary',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  />
));

ContextMenuItem.displayName = 'ContextMenuItem';

/* ─── Separator ────────────────────────────────────────────────────── */

export const ContextMenuSeparator = forwardRef<
  ElementRef<typeof ContextMenuPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator
    ref={ref}
    className={cn('h-px bg-border my-1', className)}
    {...props}
  />
));

ContextMenuSeparator.displayName = 'ContextMenuSeparator';

/* ─── Label ────────────────────────────────────────────────────────── */

export const ContextMenuLabel = forwardRef<
  ElementRef<typeof ContextMenuPrimitive.Label>,
  ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Label
    ref={ref}
    className={cn('px-2 py-1.5 text-xs font-semibold text-muted uppercase tracking-wider', className)}
    {...props}
  />
));

ContextMenuLabel.displayName = 'ContextMenuLabel';
