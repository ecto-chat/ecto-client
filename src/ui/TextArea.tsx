import { forwardRef, useEffect, useRef, type ComponentPropsWithRef } from 'react';
import { cn } from '@/lib/cn';

type TextAreaProps = {
  label?: string;
  error?: string;
  maxRows?: number;
  fillParent?: boolean;
} & ComponentPropsWithRef<'textarea'>;

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea({ label, error, maxRows = 8, fillParent, className, onChange, value, ...props }, ref) {
    const internalRef = useRef<HTMLTextAreaElement | null>(null);

    const setRefs = (node: HTMLTextAreaElement | null) => {
      internalRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    const resize = () => {
      if (fillParent) return;
      const el = internalRef.current;
      if (!el) return;

      // Reset height to auto so scrollHeight reflects actual content height
      el.style.height = 'auto';

      // Compute the line height from computed styles
      const computed = getComputedStyle(el);
      const lineHeight = parseFloat(computed.lineHeight) || 20;
      const paddingTop = parseFloat(computed.paddingTop) || 0;
      const paddingBottom = parseFloat(computed.paddingBottom) || 0;
      const borderTop = parseFloat(computed.borderTopWidth) || 0;
      const borderBottom = parseFloat(computed.borderBottomWidth) || 0;

      const maxHeight = lineHeight * maxRows + paddingTop + paddingBottom + borderTop + borderBottom;
      const newHeight = Math.min(el.scrollHeight, maxHeight);

      el.style.height = `${newHeight}px`;
    };

    // Resize whenever the value changes (controlled mode)
    useEffect(() => {
      resize();
    });

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e);
      resize();
    };

    return (
      <div className={cn('flex flex-col gap-2', fillParent && 'h-full')}>
        {label && <label className="text-sm font-medium text-secondary">{label}</label>}
        <textarea
          ref={setRefs}
          rows={1}
          value={value}
          onChange={handleChange}
          className={cn(
            'w-full rounded-md bg-secondary border-2 border-primary text-sm text-primary placeholder:text-muted',
            'focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-primary-active',
            'transition-colors duration-150 resize-none py-2.5 px-3',
            fillParent && 'h-full',
            error && 'ring-1 ring-danger/40 border-danger/40',
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }
);
