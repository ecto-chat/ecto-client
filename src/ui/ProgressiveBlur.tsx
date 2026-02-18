import { cn } from '@/lib/cn';

type ProgressiveBlurProps = {
  position: 'top' | 'bottom';
  height?: number;
  className?: string;
};

export function ProgressiveBlur({ position, height = 60, className }: ProgressiveBlurProps) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute left-0 right-0 z-10',
        position === 'top' ? 'top-0' : 'bottom-0',
        className,
      )}
      style={{
        height,
        background: position === 'top'
          ? 'linear-gradient(to bottom, var(--color-bg-primary), transparent)'
          : 'linear-gradient(to top, var(--color-bg-primary), transparent)',
      }}
    />
  );
}
