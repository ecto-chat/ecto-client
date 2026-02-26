import { motion, AnimatePresence } from 'motion/react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Braces,
  TextQuote,
  ListOrdered,
  List,
  Link2,
  EyeOff,
} from 'lucide-react';

import { IconButton } from '@/ui';
import type { MarkdownAction } from '@/hooks/useMarkdownShortcuts';

type MarkdownToolbarProps = {
  visible: boolean;
  onAction: (action: MarkdownAction) => void;
};

const actions: { action: MarkdownAction; icon: typeof Bold; label: string; shortcut?: string }[] = [
  { action: 'bold', icon: Bold, label: 'Bold', shortcut: 'Ctrl+B' },
  { action: 'italic', icon: Italic, label: 'Italic', shortcut: 'Ctrl+I' },
  { action: 'strikethrough', icon: Strikethrough, label: 'Strikethrough', shortcut: 'Ctrl+Shift+X' },
  { action: 'code', icon: Code, label: 'Inline Code', shortcut: 'Ctrl+E' },
  { action: 'codeblock', icon: Braces, label: 'Code Block' },
  { action: 'blockquote', icon: TextQuote, label: 'Blockquote', shortcut: 'Ctrl+Shift+>' },
  { action: 'orderedList', icon: ListOrdered, label: 'Ordered List' },
  { action: 'unorderedList', icon: List, label: 'Unordered List' },
  { action: 'link', icon: Link2, label: 'Link' },
  { action: 'spoiler', icon: EyeOff, label: 'Spoiler' },
];

export function MarkdownToolbar({ visible, onAction }: MarkdownToolbarProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="overflow-hidden border-b-2 border-primary"
        >
          <div className="flex items-center gap-0.5 px-2 py-1">
            {actions.map(({ action, icon: Icon, label, shortcut }) => (
              <IconButton
                key={action}
                variant="ghost"
                size="sm"
                tooltip={shortcut ? `${label} (${shortcut})` : label}
                onClick={() => onAction(action)}
              >
                <Icon size={15} />
              </IconButton>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
