import { create } from 'zustand';

interface NotifyEntry {
  ts: number;
  type: 'message' | 'mention';
}

interface NotifyStore {
  // serverId → channelId → latest notification
  notifications: Map<string, Map<string, NotifyEntry>>;

  addNotification: (serverId: string, channelId: string, ts: number, type: 'message' | 'mention') => void;
  clearNotifications: (serverId: string, channelId?: string) => void;
}

export const useNotifyStore = create<NotifyStore>()((set) => ({
  notifications: new Map(),

  addNotification: (serverId, channelId, ts, type) =>
    set((state) => {
      const notifications = new Map(state.notifications);
      const serverNotifs = new Map(notifications.get(serverId) ?? new Map());
      serverNotifs.set(channelId, { ts, type });
      notifications.set(serverId, serverNotifs);
      return { notifications };
    }),

  clearNotifications: (serverId, channelId) =>
    set((state) => {
      const notifications = new Map(state.notifications);
      if (channelId) {
        const serverNotifs = new Map(notifications.get(serverId) ?? new Map());
        serverNotifs.delete(channelId);
        notifications.set(serverId, serverNotifs);
      } else {
        notifications.delete(serverId);
      }
      return { notifications };
    }),
}));
