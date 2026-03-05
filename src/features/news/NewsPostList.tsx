import { AlertCircle, Newspaper, Pencil, Trash2 } from 'lucide-react';
import type { NewsPost } from 'ecto-shared';
import { connectionManager } from '@/services/connection-manager';
import { cssUrl } from '@/lib/css-utils';
import { ScrollArea } from '@/ui/ScrollArea';
import { Spinner, EmptyState } from '@/ui';
import { Avatar } from '@/ui/Avatar';
import { useNewsPosts } from '@/hooks/useNews';

interface NewsPostListProps {
  serverId: string;
  channelId: string;
  canManage: boolean;
  onSelect: (post: NewsPost) => void;
  onEdit: (post: NewsPost) => void;
}

export function NewsPostList({ serverId, channelId, canManage, onSelect, onEdit }: NewsPostListProps) {
  const { posts, loading, hasMore, loadMore } = useNewsPosts(serverId, channelId);

  const handleDelete = async (postId: string) => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    try {
      await trpc.news.deletePost.mutate({ post_id: postId });
      // WS event will remove the post from the list
    } catch {
      // handle silently
    }
  };

  if (loading && posts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState icon={<Newspaper />} title="No posts yet" description="Create the first news post for this channel." />
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="max-w-[720px] mx-auto p-4 space-y-4">
        {posts.map((post) => (
          <div
            key={post.id}
            className="rounded-lg bg-tertiary hover:bg-secondary transition-colors cursor-pointer overflow-hidden group"
            onClick={() => onSelect(post)}
          >
            {post.hero_image_url && (
              <div
                className="h-48 w-full bg-cover bg-center"
                style={{ backgroundImage: cssUrl(post.hero_image_url) }}
              />
            )}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-bold text-primary group-hover:underline">{post.title}</h2>
                {post.discovery_validation_errors && post.discovery_validation_errors.length > 0 && (
                  <span className="shrink-0 flex items-center gap-1 text-[11px] text-danger" title={post.discovery_validation_errors.join('\n')}>
                    <AlertCircle size={14} />
                    {post.discovery_validation_errors.length}
                  </span>
                )}
              </div>
              {post.subtitle && <p className="text-sm text-secondary mb-2">{post.subtitle}</p>}
              <div className="flex items-center gap-2 text-xs text-muted">
                <Avatar src={post.author.avatar_url} username={post.author.username} size={16} />
                <span>{post.author.display_name ?? post.author.username}</span>
                <span>&middot;</span>
                <span>{new Date(post.published_at).toLocaleDateString()}</span>
                <span>&middot;</span>
                <span>{post.comment_count} comments</span>
                {canManage && (
                  <span className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="p-1 hover:text-primary"
                      onClick={(e) => { e.stopPropagation(); onEdit(post); }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="p-1 hover:text-danger"
                      onClick={(e) => { e.stopPropagation(); handleDelete(post.id); }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {hasMore && (
          <div className="flex justify-center py-4">
            <button
              className="px-4 py-2 text-sm bg-tertiary text-secondary rounded-md hover:bg-secondary hover:text-primary transition-colors"
              onClick={() => {
                const last = posts[posts.length - 1];
                if (last) loadMore(last.id);
              }}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
