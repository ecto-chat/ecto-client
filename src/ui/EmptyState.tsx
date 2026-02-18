import { type ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/cn';

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'flex flex-col items-center justify-center px-6 py-16',
        className,
      )}
    >
      {icon && (
        <div className="mb-3 text-muted [&>*]:size-12">{icon}</div>
      )}
      <h3 className="text-lg font-medium text-secondary">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-center text-sm text-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}
