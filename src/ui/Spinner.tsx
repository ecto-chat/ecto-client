import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

const sizeMap = {
  sm: 16,
  md: 24,
  lg: 32,
} as const;

type SpinnerProps = {
  size?: keyof typeof sizeMap;
  className?: string;
};

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <Loader2
      size={sizeMap[size]}
      className={cn('animate-spin text-muted', className)}
    />
  );
}
