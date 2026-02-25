import { useState, useEffect, useCallback, useRef } from 'react';
import type { PageContent } from 'ecto-shared';
import { connectionManager } from '@/services/connection-manager';

export function usePage(channelId: string, serverId: string) {
  const [page, setPage] = useState<PageContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef(page);
  pageRef.current = page;

  const fetch = useCallback(async () => {
    if (!serverId || !channelId) return;
    setLoading(true);
    setError(null);
    try {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) throw new Error('Not connected');
      const result = await trpc.pages.getContent.query({ channel_id: channelId });
      setPage(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load page');
    } finally {
      setLoading(false);
    }
  }, [serverId, channelId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Listen for page.update WS events
  useEffect(() => {
    const handler = (data: PageContent) => {
      if (data.channel_id === channelId) {
        setPage(data);
      }
    };
    pageEventListeners.add(handler);
    return () => { pageEventListeners.delete(handler); };
  }, [channelId]);

  return { page, loading, error, refetch: fetch };
}

/** Simple event bus for page.update events dispatched from server-event-handler */
export const pageEventListeners = new Set<(data: PageContent) => void>();
