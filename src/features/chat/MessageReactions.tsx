import { Button } from '@/ui';

import { cn } from '@/lib/cn';

import type { ReactionGroup } from 'ecto-shared';

type MessageReactionsProps = {
  reactions: ReactionGroup[];
  onReact: (emoji: string) => void;
};

export function MessageReactions({ reactions, onReact }: MessageReactionsProps) {
  if (reactions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {reactions.map((reaction) => (
        <Button
          key={reaction.emoji}
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 h-auto font-normal',
            'bg-tertiary border text-xs',
            'hover:bg-hover',
            reaction.me
              ? 'border-accent bg-accent-subtle'
              : 'border-primary',
          )}
          onClick={() => onReact(reaction.emoji)}
        >
          <span>{reaction.emoji}</span>
          <span className="text-secondary">{reaction.count}</span>
        </Button>
      ))}
    </div>
  );
}
