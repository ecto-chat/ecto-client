import { useCallback } from 'react';
import { useActivityStore } from '@/stores/activity';
import { connectionManager } from '@/services/connection-manager';

export function useActivityActions() {
  const markRead = useCallback((itemIds: string[]) => {
    const items = useActivityStore.getState().items;
    const bySource = new Map<string, string[]>();

    for (const id of itemIds) {
      const item = items.find((i) => i.id === id);
      if (!item || item.read) continue;
      const source = item.source.server_id;
      const arr = bySource.get(source) ?? [];
      arr.push(id);
      bySource.set(source, arr);
    }

    // Optimistic update
    useActivityStore.getState().markRead(itemIds);

    // Fire API calls per source
    for (const [source, ids] of bySource) {
      if (source === 'central') {
        connectionManager.getCentralTrpc()?.activity.markRead.mutate({ activity_ids: ids }).catch(() => {});
      } else {
        const trpc = connectionManager.getServerTrpc(source);
        trpc?.activity.markRead.mutate({ activity_ids: ids }).catch(() => {});
      }
    }
  }, []);

  const markAllRead = useCallback(() => {
    useActivityStore.getState().markAllRead();

    // Fire for central
    connectionManager.getCentralTrpc()?.activity.markAllRead.mutate().catch(() => {});

    // Fire for all connected servers
    const items = useActivityStore.getState().items;
    const serverIds = new Set(items.map((i) => i.source.server_id).filter((s) => s !== 'central'));
    for (const sid of serverIds) {
      const trpc = connectionManager.getServerTrpc(sid);
      trpc?.activity.markAllRead.mutate().catch(() => {});
    }
  }, []);

  return { markRead, markAllRead };
}
