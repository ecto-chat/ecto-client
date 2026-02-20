import { create } from 'zustand';

import { preferenceManager } from '../services/preference-manager.js';

interface NotifyEntry {
  ts: number;
  type: 'message' | 'mention';
}

interface NotifyStore {
  // serverId → channelId → latest notification
  notifications: Map<string, Map<string, NotifyEntry>>;
  mutedServers: Set<string>;
  mutedChannels: Set<string>;

  addNotification: (serverId: string, channelId: string, ts: number, type: 'message' | 'mention') => void;
  clearNotifications: (serverId: string, channelId?: string) => void;
  toggleMuteServer: (serverId: string) => void;
  toggleMuteChannel: (channelId: string) => void;
  isServerMuted: (serverId: string) => boolean;
  isChannelMuted: (channelId: string) => boolean;
  hydrateFromPreferences: () => void;
}

export const useNotifyStore = create<NotifyStore>()((set, get) => ({
  notifications: new Map(),
  mutedServers: new Set(preferenceManager.getUser<string[]>('muted-servers', [])),
  mutedChannels: new Set(preferenceManager.getUser<string[]>('muted-channels', [])),

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

  toggleMuteServer: (serverId) =>
    set((state) => {
      const mutedServers = new Set(state.mutedServers);
      if (mutedServers.has(serverId)) mutedServers.delete(serverId);
      else mutedServers.add(serverId);
      preferenceManager.setUser('muted-servers', [...mutedServers]);
      return { mutedServers };
    }),

  toggleMuteChannel: (channelId) =>
    set((state) => {
      const mutedChannels = new Set(state.mutedChannels);
      if (mutedChannels.has(channelId)) mutedChannels.delete(channelId);
      else mutedChannels.add(channelId);
      preferenceManager.setUser('muted-channels', [...mutedChannels]);
      return { mutedChannels };
    }),

  isServerMuted: (serverId) => get().mutedServers.has(serverId),
  isChannelMuted: (channelId) => get().mutedChannels.has(channelId),

  hydrateFromPreferences: () => set({
    mutedServers: new Set(preferenceManager.getUser<string[]>('muted-servers', [])),
    mutedChannels: new Set(preferenceManager.getUser<string[]>('muted-channels', [])),
  }),
}));
