import { motion } from 'motion/react';
import { Hash } from 'lucide-react';

import { Avatar } from '@/ui';

import { cn } from '@/lib/cn';

import type { Member, Channel } from 'ecto-shared';

import type { AutocompleteState } from './autocomplete';

type AutocompletePopupProps = {
  autocomplete: AutocompleteState;
  items: (Member | Channel)[];
  selectedIndex: number;
  onSelect: (item: Member | Channel) => void;
};

export function AutocompletePopup({
  autocomplete,
  items,
  selectedIndex,
  onSelect,
}: AutocompletePopupProps) {
  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 4 }}
      transition={{ duration: 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="absolute bottom-full left-0 right-0 mb-1 bg-surface border border-border rounded-lg shadow-xl p-1 z-50"
    >
      {items.map((item, i) => {
        if (autocomplete.type === '@') {
          const member = item as Member;
          return (
            <div
              key={member.user_id}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm',
                i === selectedIndex
                  ? 'bg-hover text-primary'
                  : 'text-secondary hover:bg-[rgba(30,42,74,0.5)]',
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(item);
              }}
            >
              <Avatar
                src={member.avatar_url}
                username={member.username}
                size={20}
              />
              <span>
                {member.nickname ?? member.display_name ?? member.username}
              </span>
            </div>
          );
        }

        const channel = item as Channel;
        return (
          <div
            key={channel.id}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm',
              i === selectedIndex
                ? 'bg-hover text-primary'
                : 'text-secondary hover:bg-[rgba(30,42,74,0.5)]',
            )}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(item);
            }}
          >
            <Hash size={16} className="text-muted shrink-0" />
            <span>{channel.name}</span>
          </div>
        );
      })}
    </motion.div>
  );
}
