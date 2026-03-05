import { useState, type FormEvent } from 'react';
import type { NewsComment } from 'ecto-shared';
import { connectionManager } from '@/services/connection-manager';
import { Send } from 'lucide-react';

interface NewsCommentInputProps {
  serverId: string;
  postId: string;
  onCommentAdded: (comment: NewsComment) => void;
}

export function NewsCommentInput({ serverId, postId, onCommentAdded }: NewsCommentInputProps) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;

    setSending(true);
    try {
      const comment = await trpc.news.addComment.mutate({
        post_id: postId,
        content: content.trim(),
      });
      onCommentAdded(comment);
      setContent('');
    } catch {
      // handle silently
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-4">
      <input
        className="flex-1 px-3 py-2 text-sm bg-primary text-primary rounded-md border border-primary focus:outline-none focus:ring-1 focus:ring-accent"
        placeholder="Add a comment..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={2000}
        disabled={sending}
      />
      <button
        type="submit"
        className="px-3 py-2 bg-accent text-white rounded-md hover:bg-accent/80 transition-colors disabled:opacity-50"
        disabled={sending || !content.trim()}
      >
        <Send size={16} />
      </button>
    </form>
  );
}
