import { useState, useEffect, useCallback } from 'react';
import type { NewsPost, NewsComment } from 'ecto-shared';
import { connectionManager } from 'ecto-core';

// ── Event listener bus (dispatched from server-event-handler) ──

export type NewsPostEvent =
  | { type: 'create'; post: NewsPost }
  | { type: 'update'; post: NewsPost }
  | { type: 'delete'; id: string; channel_id: string };

export type NewsCommentEvent =
  | { type: 'create'; comment: NewsComment }
  | { type: 'delete'; id: string; post_id: string };

/** Simple event bus for news post events dispatched from server-event-handler */
export const newsPostListeners = new Set<(event: NewsPostEvent) => void>();

/** Simple event bus for news comment events dispatched from server-event-handler */
export const newsCommentListeners = new Set<(event: NewsCommentEvent) => void>();

// ── Hooks ──

/** Subscribe to real-time post list updates for a specific news channel */
export function useNewsPosts(serverId: string, channelId: string) {
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (before?: string) => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;

    setLoading(true);
    try {
      const res = await trpc.news.listPosts.query({ channel_id: channelId, before, limit: 20 });
      if (before) {
        setPosts((prev) => [...prev, ...res.posts]);
      } else {
        setPosts(res.posts);
      }
      setHasMore(res.has_more);
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  }, [serverId, channelId]);

  useEffect(() => {
    load();
  }, [load]);

  // Listen for real-time post events
  useEffect(() => {
    const handler = (event: NewsPostEvent) => {
      switch (event.type) {
        case 'create':
          if (event.post.channel_id === channelId) {
            setPosts((prev) => [event.post, ...prev]);
          }
          break;
        case 'update':
          if (event.post.channel_id === channelId) {
            setPosts((prev) => prev.map((p) => (p.id === event.post.id ? event.post : p)));
          }
          break;
        case 'delete':
          if (event.channel_id === channelId) {
            setPosts((prev) => prev.filter((p) => p.id !== event.id));
          }
          break;
      }
    };
    newsPostListeners.add(handler);
    return () => { newsPostListeners.delete(handler); };
  }, [channelId]);

  return { posts, loading, hasMore, loadMore: load };
}

/** Subscribe to real-time comment updates for a specific news post */
export function useNewsComments(serverId: string, postId: string) {
  const [comments, setComments] = useState<NewsComment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    setLoading(true);
    try {
      const res = await trpc.news.listComments.query({ post_id: postId, limit: 100 });
      setComments(res.comments);
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  }, [serverId, postId]);

  useEffect(() => {
    load();
  }, [load]);

  // Listen for real-time comment events
  useEffect(() => {
    const handler = (event: NewsCommentEvent) => {
      switch (event.type) {
        case 'create':
          if (event.comment.post_id === postId) {
            setComments((prev) => [...prev, event.comment]);
          }
          break;
        case 'delete':
          if (event.post_id === postId) {
            setComments((prev) => prev.filter((c) => c.id !== event.id));
          }
          break;
      }
    };
    newsCommentListeners.add(handler);
    return () => { newsCommentListeners.delete(handler); };
  }, [postId]);

  const addComment = (comment: NewsComment) => {
    setComments((prev) => [...prev, comment]);
  };

  return { comments, loading, addComment };
}
