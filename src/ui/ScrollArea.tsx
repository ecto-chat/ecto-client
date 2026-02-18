import { useState, useRef, useCallback, forwardRef, type ReactNode } from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { cn } from '@/lib/cn';
import { ProgressiveBlur } from './ProgressiveBlur';

type ScrollAreaProps = {
  children: ReactNode;
  className?: string;
  fadeEdges?: boolean;
  fadeHeight?: number;
  orientation?: 'vertical' | 'horizontal' | 'both';
  /** Override horizontal overflow on root (e.g. 'visible' to prevent badge clipping). */
  overflowX?: 'hidden' | 'visible';
  /** Optional scroll handler forwarded to the internal viewport element. */
  onScroll?: () => void;
};

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea(
  { children, className, fadeEdges = true, fadeHeight = 60, orientation = 'vertical', overflowX, onScroll: onScrollProp },
  forwardedRef,
) {
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    setShowTopFade(el.scrollTop > 10);
    setShowBottomFade(el.scrollHeight - el.scrollTop - el.clientHeight > 10);
    onScrollProp?.();
  }, [onScrollProp]);

  // Check on mount too using a callback ref pattern
  const setViewportRef = useCallback((node: HTMLDivElement | null) => {
    (viewportRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    // Forward to external ref
    if (typeof forwardedRef === 'function') {
      forwardedRef(node);
    } else if (forwardedRef) {
      (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
    if (node) {
      setShowTopFade(node.scrollTop > 10);
      setShowBottomFade(node.scrollHeight - node.scrollTop - node.clientHeight > 10);
    }
  }, [forwardedRef]);

  return (
    <ScrollAreaPrimitive.Root
      className={cn('relative overflow-hidden', overflowX === 'visible' && 'overflow-x-visible', className)}
    >
      <div className="relative h-full">
        {fadeEdges && showTopFade && <ProgressiveBlur position="top" height={fadeHeight} />}
        <ScrollAreaPrimitive.Viewport
          ref={setViewportRef}
          className="h-full w-full rounded-[inherit]"
          onScroll={handleScroll}
        >
          {children}
        </ScrollAreaPrimitive.Viewport>
        {fadeEdges && showBottomFade && <ProgressiveBlur position="bottom" height={fadeHeight} />}
      </div>
      {(orientation === 'vertical' || orientation === 'both') && (
        <ScrollAreaPrimitive.Scrollbar
          orientation="vertical"
          className="flex touch-none select-none p-0.5 transition-colors duration-150 data-[orientation=vertical]:w-2"
        >
          <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-tertiary hover:bg-hover transition-colors" />
        </ScrollAreaPrimitive.Scrollbar>
      )}
      {(orientation === 'horizontal' || orientation === 'both') && (
        <ScrollAreaPrimitive.Scrollbar
          orientation="horizontal"
          className="flex touch-none select-none p-0.5 transition-colors duration-150 data-[orientation=horizontal]:h-2"
        >
          <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-tertiary hover:bg-hover transition-colors" />
        </ScrollAreaPrimitive.Scrollbar>
      )}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
});
