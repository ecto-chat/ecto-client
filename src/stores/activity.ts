import { create } from 'zustand';
import type { ActivityItem } from 'ecto-shared';

interface ActivityStore {
  items: ActivityItem[];
  unreadNotifications: number;   // mentions + reactions + central DMs
  unreadServerDms: number;       // server DM count
  hasMore: Map<string, boolean>; // per source

  addItem: (item: ActivityItem) => void;
  addItems: (items: ActivityItem[], source: string, hasMore: boolean) => void;
  markRead: (itemIds: string[]) => void;
  markAllRead: () => void;
  setUnreadCounts: (notifications: number, serverDms: number) => void;
  clear: () => void;
}

export const useActivityStore = create<ActivityStore>()((set) => ({
  items: [],
  unreadNotifications: 0,
  unreadServerDms: 0,
  hasMore: new Map(),

  addItem: (item) =>
    set((state) => {
      // Dedup
      if (state.items.some((i) => i.id === item.id)) return state;
      const items = [item, ...state.items].sort(
        (a, b) => b.created_at.localeCompare(a.created_at),
      );
      const isServerDm = item.type === 'server_dm';
      return {
        items,
        unreadNotifications: state.unreadNotifications + (isServerDm || item.read ? 0 : 1),
        unreadServerDms: state.unreadServerDms + (isServerDm && !item.read ? 1 : 0),
      };
    }),

  addItems: (newItems, source, hasMore) =>
    set((state) => {
      const existingIds = new Set(state.items.map((i) => i.id));
      const unique = newItems.filter((i) => !existingIds.has(i.id));
      const items = [...state.items, ...unique].sort(
        (a, b) => b.created_at.localeCompare(a.created_at),
      );
      const newHasMore = new Map(state.hasMore);
      newHasMore.set(source, hasMore);
      return { items, hasMore: newHasMore };
    }),

  markRead: (itemIds) =>
    set((state) => {
      const idSet = new Set(itemIds);
      let notifDelta = 0;
      let dmDelta = 0;
      const items = state.items.map((item) => {
        if (idSet.has(item.id) && !item.read) {
          if (item.type === 'server_dm') dmDelta++;
          else notifDelta++;
          return { ...item, read: true };
        }
        return item;
      });
      return {
        items,
        unreadNotifications: Math.max(0, state.unreadNotifications - notifDelta),
        unreadServerDms: Math.max(0, state.unreadServerDms - dmDelta),
      };
    }),

  markAllRead: () =>
    set((state) => ({
      items: state.items.map((item) => (item.read ? item : { ...item, read: true })),
      unreadNotifications: 0,
      unreadServerDms: 0,
    })),

  setUnreadCounts: (notifications, serverDms) =>
    set((state) => ({
      unreadNotifications: state.unreadNotifications + notifications,
      unreadServerDms: state.unreadServerDms + serverDms,
    })),

  clear: () =>
    set({
      items: [],
      unreadNotifications: 0,
      unreadServerDms: 0,
      hasMore: new Map(),
    }),
}));
