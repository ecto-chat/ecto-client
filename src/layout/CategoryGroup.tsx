import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Settings } from 'lucide-react';
import { easeContent } from '@/lib/animations';
import { cn } from '@/lib/cn';

interface CategoryGroupProps {
  name: string;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
  onSettingsClick?: () => void;
}

export function CategoryGroup({
  name,
  collapsed,
  onToggle,
  children,
  dragHandleProps,
  onSettingsClick,
}: CategoryGroupProps) {
  return (
    <div>
      <div
        className="flex items-center px-2 pt-3 pb-1 cursor-pointer select-none group focus-visible:ring-1 focus-visible:ring-accent/40 outline-none rounded-md"
        onClick={onToggle}
        {...dragHandleProps}
      >
        <ChevronDown
          size={12}
          className={cn(
            'text-muted transition-transform duration-200 mr-1',
            collapsed && '-rotate-90',
          )}
        />
        <span className="text-xs uppercase tracking-wider text-muted font-semibold">
          {name}
        </span>
        {onSettingsClick && (
          <span
            className="ml-auto text-muted opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:text-primary"
            title="Category Settings"
            onClick={(e) => {
              e.stopPropagation();
              onSettingsClick();
            }}
          >
            <Settings size={12} />
          </span>
        )}
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={easeContent}
            style={{ overflow: 'hidden' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
