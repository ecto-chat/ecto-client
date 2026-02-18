import { Avatar } from '@/ui';

import { renderMarkdown } from '@/lib/markdown';

import type { Message } from 'ecto-shared';

type SearchResultProps = {
  message: Message;
  channelName?: string;
  onClick: () => void;
};

export function SearchResult({ message, channelName, onClick }: SearchResultProps) {
  const timestamp = new Date(message.created_at).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer flex-col gap-1 rounded-md px-3 py-2 hover:bg-hover transition-colors"
    >
      <div className="flex items-center gap-2">
        <Avatar src={message.author?.avatar_url} username={message.author?.username ?? 'Unknown'} size={20} />
        <span className="text-sm text-primary">
          {message.author?.display_name ?? message.author?.username ?? 'Unknown'}
        </span>
        {channelName && (
          <span className="rounded bg-tertiary px-1.5 py-0.5 text-xs text-muted">#{channelName}</span>
        )}
        <span className="text-xs text-muted">{timestamp}</span>
      </div>
      <div
        className="text-sm text-secondary message-markdown"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content ?? '') }}
      />
    </div>
  );
}
