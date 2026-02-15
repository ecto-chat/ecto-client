import { create } from 'zustand';

interface NotifyEntry {
  ts: number;
  type: 'message' | 'mention';
}

const MUTED_SERVERS_KEY = 'ecto-muted-servers';
const MUTED_CHANNELS_KEY = 'ecto-muted-channels';

function loadSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* ignore */ }
  return new Set();
}

function saveSet(key: string, s: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...s]));
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
}

export const useNotifyStore = create<NotifyStore>()((set, get) => ({
  notifications: new Map(),
  mutedServers: loadSet(MUTED_SERVERS_KEY),
  mutedChannels: loadSet(MUTED_CHANNELS_KEY),

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
      saveSet(MUTED_SERVERS_KEY, mutedServers);
      return { mutedServers };
    }),

  toggleMuteChannel: (channelId) =>
    set((state) => {
      const mutedChannels = new Set(state.mutedChannels);
      if (mutedChannels.has(channelId)) mutedChannels.delete(channelId);
      else mutedChannels.add(channelId);
      saveSet(MUTED_CHANNELS_KEY, mutedChannels);
      return { mutedChannels };
    }),

  isServerMuted: (serverId) => get().mutedServers.has(serverId),
  isChannelMuted: (channelId) => get().mutedChannels.has(channelId),
}));
