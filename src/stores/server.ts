import { create } from 'zustand';
import type { ServerListEntry } from 'ecto-shared';

interface ServerMeta {
  setup_completed: boolean;
  admin_user_id: string | null;
  user_id: string | null;
  default_channel_id: string | null;
  banner_url: string | null;
}

interface ServerStore {
  /** Map keyed by server UUID (id), not address */
  servers: Map<string, ServerListEntry>;
  /** Ordered list of server UUIDs */
  serverOrder: string[];
  /** Per-server metadata from system.ready (setup state, admin) */
  serverMeta: Map<string, ServerMeta>;
  /** Per-server event counter — bumped on invite/ban events as a refetch trigger */
  eventSeq: Map<string, number>;

  setServers: (entries: ServerListEntry[]) => void;
  addServer: (entry: ServerListEntry) => void;
  removeServer: (id: string) => void;
  updateServer: (id: string, updates: Partial<ServerListEntry>) => void;
  reorderServers: (order: string[]) => void;
  setServerMeta: (id: string, meta: ServerMeta) => void;
  incrementEventSeq: (id: string) => void;
}

export const useServerStore = create<ServerStore>()((set) => ({
  servers: new Map(),
  serverOrder: [],
  serverMeta: new Map(),
  eventSeq: new Map(),

  setServers: (entries) => {
    const servers = new Map<string, ServerListEntry>();
    const order: string[] = [];
    for (const entry of entries.sort((a, b) => a.position - b.position)) {
      servers.set(entry.id, entry);
      order.push(entry.id);
    }
    set({ servers, serverOrder: order });
  },

  addServer: (entry) =>
    set((state) => {
      const servers = new Map(state.servers);
      servers.set(entry.id, entry);
      // Only add to order if not already present
      const orderSet = new Set(state.serverOrder);
      if (orderSet.has(entry.id)) return { servers };
      return { servers, serverOrder: [...state.serverOrder, entry.id] };
    }),

  removeServer: (id) =>
    set((state) => {
      const servers = new Map(state.servers);
      servers.delete(id);
      return {
        servers,
        serverOrder: state.serverOrder.filter((s) => s !== id),
      };
    }),

  updateServer: (id, updates) =>
    set((state) => {
      const existing = state.servers.get(id);
      if (!existing) return state;
      const servers = new Map(state.servers);
      servers.set(id, { ...existing, ...updates });
      return { servers };
    }),

  reorderServers: (order) => set({ serverOrder: order }),

  setServerMeta: (id, meta) =>
    set((state) => {
      const serverMeta = new Map(state.serverMeta);
      serverMeta.set(id, meta);
      return { serverMeta };
    }),

  incrementEventSeq: (id) =>
    set((state) => {
      const eventSeq = new Map(state.eventSeq);
      eventSeq.set(id, (eventSeq.get(id) ?? 0) + 1);
      return { eventSeq };
    }),
}));
