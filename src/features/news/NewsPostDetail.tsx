import { useState, useEffect } from 'react';
import { ArrowLeft, Pencil, MessageCircle } from 'lucide-react';
import type { NewsPost } from 'ecto-shared';
import { cssUrl } from '@/lib/css-utils';
import { ScrollArea } from '@/ui/ScrollArea';
import { IconButton, Spinner } from '@/ui';
import { Avatar } from '@/ui/Avatar';
import { renderMarkdown } from '@/lib/markdown';
import { NewsCommentInput } from './NewsCommentInput';
import { useNewsComments, newsPostListeners, type NewsPostEvent } from '@/hooks/useNews';

interface NewsPostDetailProps {
  serverId: string;
  channelId: string;
  post: NewsPost;
  canManage: boolean;
  onBack: () => void;
  onEdit: (post: NewsPost) => void;
}

export function NewsPostDetail({ serverId, channelId, post: initialPost, canManage, onBack, onEdit }: NewsPostDetailProps) {
  const [post, setPost] = useState(initialPost);
  const { comments, loading: loadingComments, addComment } = useNewsComments(serverId, post.id);
  const [showAllComments, setShowAllComments] = useState(false);

  // Listen for real-time post updates and deletions
  useEffect(() => {
    const handler = (event: NewsPostEvent) => {
      switch (event.type) {
        case 'update':
          if (event.post.id === post.id) {
            setPost(event.post);
          }
          break;
        case 'delete':
          if (event.id === post.id) {
            onBack();
          }
          break;
      }
    };
    newsPostListeners.add(handler);
    return () => { newsPostListeners.delete(handler); };
  }, [post.id, onBack]);

  // Update comment count based on live comments length
  const commentCount = comments.length;

  const displayedComments = showAllComments ? comments : comments.slice(0, 3);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-[60px] shrink-0 items-center gap-2 border-b-2 border-primary px-4">
        <IconButton variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={18} />
        </IconButton>
        <span className="text-sm text-primary truncate">{post.title}</span>
        {canManage && (
          <IconButton variant="ghost" size="sm" className="ml-auto" onClick={() => onEdit(post)}>
            <Pencil size={16} />
          </IconButton>
        )}
      </div>

      <ScrollArea className="flex-1">
        <article className="max-w-[720px] mx-auto p-6">
          {/* Hero image */}
          {post.hero_image_url && (
            <div
              className="w-full h-64 rounded-lg mb-6 bg-cover bg-center"
              style={{ backgroundImage: cssUrl(post.hero_image_url) }}
            />
          )}

          {/* Title & subtitle */}
          <h1 className="text-2xl font-bold text-primary mb-2">{post.title}</h1>
          {post.subtitle && (
            <p className="text-base text-secondary mb-4">{post.subtitle}</p>
          )}

          {/* Author & date */}
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-primary">
            <Avatar src={post.author.avatar_url} username={post.author.username} size={40} />
            <div>
              <p className="text-sm font-medium text-primary">
                {post.author.display_name ?? post.author.username}
              </p>
              <p className="text-xs text-muted">{new Date(post.published_at).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Content */}
          <div
            className="prose prose-invert max-w-none text-sm leading-relaxed text-secondary [&_h1]:text-primary [&_h2]:text-primary [&_h3]:text-primary [&_a]:text-accent [&_strong]:text-primary"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
          />

          {/* Comments section */}
          <div className="mt-8 pt-6 border-t border-primary">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle size={18} className="text-muted" />
              <h3 className="text-sm font-semibold text-primary">
                Comments ({commentCount})
              </h3>
            </div>

            {loadingComments ? (
              <div className="flex justify-center py-4"><Spinner /></div>
            ) : (
              <div className="space-y-3">
                {displayedComments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar src={c.author.avatar_url} username={c.author.username} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-primary">
                          {c.author.display_name ?? c.author.username}
                        </span>
                        <span className="text-xs text-muted">
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-secondary mt-0.5">{c.content}</p>
                    </div>
                  </div>
                ))}

                {!showAllComments && comments.length > 3 && (
                  <button
                    className="text-xs text-accent hover:underline"
                    onClick={() => setShowAllComments(true)}
                  >
                    Show all {comments.length} comments
                  </button>
                )}
              </div>
            )}

            <NewsCommentInput
              serverId={serverId}
              postId={post.id}
              onCommentAdded={addComment}
            />
          </div>
        </article>
      </ScrollArea>
    </div>
  );
}
