import { create } from 'zustand';
import type { DiscoveryPost, DiscoveryServer } from 'ecto-shared';
import { toServerUrl } from '../lib/server-address.js';

interface ServerStats {
  member_count: number;
  online_count: number;
}

interface DiscoverStore {
  posts: DiscoveryPost[];
  servers: DiscoveryServer[];
  loading: boolean;
  hasMore: boolean;
  serverStats: Map<string, ServerStats>;
  searchQuery: string;
  searchResults: DiscoveryServer[];
  searchLoading: boolean;
  searchOnlineStatus: Map<string, boolean>;

  setPosts: (posts: DiscoveryPost[]) => void;
  appendPosts: (posts: DiscoveryPost[]) => void;
  setServers: (servers: DiscoveryServer[]) => void;
  setLoading: (loading: boolean) => void;
  setHasMore: (hasMore: boolean) => void;
  fetchLiveStats: (extraServers?: { server_id: string; address: string }[]) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: DiscoveryServer[]) => void;
  setSearchLoading: (loading: boolean) => void;
  setSearchOnlineStatus: (serverId: string, online: boolean) => void;
  clearSearch: () => void;
  clear: () => void;
}

export const useDiscoverStore = create<DiscoverStore>()((set, get) => ({
  posts: [],
  servers: [],
  loading: false,
  hasMore: true,
  serverStats: new Map(),
  searchQuery: '',
  searchResults: [],
  searchLoading: false,
  searchOnlineStatus: new Map(),

  setPosts: (posts) => set({ posts }),
  appendPosts: (posts) => set((s) => ({ posts: [...s.posts, ...posts] })),
  setServers: (servers) => set({ servers }),
  setLoading: (loading) => set({ loading }),
  setHasMore: (hasMore) => set({ hasMore }),

  fetchLiveStats: (extraServers) => {
    const { posts } = get();
    // Deduplicate by server address
    const addresses = new Map<string, string>();
    for (const p of posts) {
      if (p.server_address && !addresses.has(p.server_address)) {
        addresses.set(p.server_address, p.server_id);
      }
    }
    if (extraServers) {
      for (const s of extraServers) {
        if (s.address && !addresses.has(s.address)) {
          addresses.set(s.address, s.server_id);
        }
      }
    }

    for (const [address, serverId] of addresses) {
      fetch(`${toServerUrl(address)}/trpc/server.info`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (!json?.result?.data) return;
          const data = json.result.data as { member_count: number; online_count: number };
          set((s) => {
            const next = new Map(s.serverStats);
            next.set(serverId, {
              member_count: data.member_count,
              online_count: data.online_count,
            });
            return { serverStats: next };
          });
        })
        .catch(() => {});
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) => set({ searchResults: results }),
  setSearchLoading: (loading) => set({ searchLoading: loading }),
  setSearchOnlineStatus: (serverId, online) =>
    set((s) => {
      const next = new Map(s.searchOnlineStatus);
      next.set(serverId, online);
      return { searchOnlineStatus: next };
    }),
  clearSearch: () => set({ searchQuery: '', searchResults: [], searchLoading: false, searchOnlineStatus: new Map() }),

  clear: () => set({
    posts: [], servers: [], loading: false, hasMore: true, serverStats: new Map(),
    searchQuery: '', searchResults: [], searchLoading: false, searchOnlineStatus: new Map(),
  }),
}));
