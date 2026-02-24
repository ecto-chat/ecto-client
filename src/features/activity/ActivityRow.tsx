import { motion } from 'motion/react';
import { Avatar } from '@/ui';
import { cn } from '@/lib/cn';
import type { ActivityItem } from 'ecto-shared';

function formatDescription(item: ActivityItem): string {
  const name = item.actor.display_name ?? item.actor.username;
  switch (item.type) {
    case 'mention':
      return `${name} mentioned you${item.source.channel_name ? ` in #${item.source.channel_name}` : ''}`;
    case 'reaction':
      return `${name} reacted ${item.emoji ?? ''} to your message`;
    case 'dm':
      return `${name} sent you a message`;
    case 'server_dm':
      return `${name} sent you a message`;
    default:
      return `${name} activity`;
  }
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

type ActivityRowProps = {
  item: ActivityItem;
  index: number;
  onClick: (item: ActivityItem) => void;
};

export function ActivityRow({ item, index, onClick }: ActivityRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      className={cn(
        'flex items-start gap-2 px-3 py-2 cursor-pointer transition-colors hover:bg-primary',
        !item.read && 'border-l-2 border-accent',
        item.read && 'border-l-2 border-transparent',
      )}
      onClick={() => onClick(item)}
    >
      <Avatar
        src={item.actor.avatar_url}
        username={item.actor.username}
        size={32}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-primary leading-tight">
          {formatDescription(item)}
        </p>
        {item.content_preview && (
          <p className="text-xs text-muted truncate mt-0.5">
            {item.content_preview}
          </p>
        )}
      </div>
      <span className="text-[10px] text-muted shrink-0 mt-0.5">
        {formatRelativeTime(item.created_at)}
      </span>
    </motion.div>
  );
}
