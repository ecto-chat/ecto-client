import { create } from 'zustand';
import type { GlobalUser } from 'ecto-shared';
import { createCentralTrpcClient } from '../services/trpc.js';
import type { CentralTrpcClient } from '../types/trpc.js';

type AuthState = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthStore {
  user: GlobalUser | null;
  token: string | null;
  refreshToken_: string | null;
  authState: AuthState;
  centralUrl: string;

  login: (email: string, password: string) => Promise<void>;
  loginGoogle: (googleToken: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  setUser: (user: GlobalUser) => void;
  restoreSession: () => Promise<void>;
  getToken: () => string | null;
  getCentralTrpc: () => CentralTrpcClient;
}

const DEFAULT_CENTRAL_URL = 'http://localhost:4000';

export const useAuthStore = create<AuthStore>()((set, get) => {
  let refreshTimerId: ReturnType<typeof setTimeout> | null = null;

  function scheduleRefresh(token: string) {
    if (refreshTimerId) clearTimeout(refreshTimerId);
    try {
      const payload = JSON.parse(atob(token.split('.')[1]!));
      const exp = payload.exp as number;
      const msUntilExpiry = exp * 1000 - Date.now();
      const refreshIn = Math.max(msUntilExpiry - 60000, 5000);
      refreshTimerId = setTimeout(() => {
        get().refreshToken().catch(() => {
          set({ authState: 'unauthenticated', token: null, user: null });
        });
      }, refreshIn);
    } catch {
      // Invalid token format
    }
  }

  async function storeTokens(accessToken: string, refreshTok: string) {
    if (window.electronAPI) {
      await window.electronAPI.secureStore.set('access_token', accessToken);
      await window.electronAPI.secureStore.set('refresh_token', refreshTok);
    } else {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshTok);
    }
  }

  async function clearTokens() {
    if (window.electronAPI) {
      await window.electronAPI.secureStore.delete('access_token');
      await window.electronAPI.secureStore.delete('refresh_token');
    } else {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  }

  async function getStoredRefreshToken(): Promise<string | null> {
    if (window.electronAPI) {
      return window.electronAPI.secureStore.get('refresh_token');
    }
    return localStorage.getItem('refresh_token');
  }

  return {
    user: null,
    token: null,
    refreshToken_: null,
    authState: 'idle',
    centralUrl: DEFAULT_CENTRAL_URL,

    getToken: () => get().token,

    getCentralTrpc: () => createCentralTrpcClient(get().centralUrl, () => get().token),

    login: async (email, password) => {
      set({ authState: 'loading' });
      const trpc = createCentralTrpcClient(get().centralUrl, () => null);
      const result = await trpc.auth.login.mutate({ email, password });
      await storeTokens(result.access_token, result.refresh_token);
      scheduleRefresh(result.access_token);
      set({
        user: result.user,
        token: result.access_token,
        refreshToken_: result.refresh_token,
        authState: 'authenticated',
      });
    },

    loginGoogle: async (googleToken) => {
      set({ authState: 'loading' });
      const trpc = createCentralTrpcClient(get().centralUrl, () => null);
      const result = await trpc.auth.loginGoogle.mutate({ google_token: googleToken });
      await storeTokens(result.access_token, result.refresh_token);
      scheduleRefresh(result.access_token);
      set({
        user: result.user,
        token: result.access_token,
        refreshToken_: result.refresh_token,
        authState: 'authenticated',
      });
    },

    register: async (email, password, username) => {
      set({ authState: 'loading' });
      const trpc = createCentralTrpcClient(get().centralUrl, () => null);
      const result = await trpc.auth.register.mutate({ email, password, username });
      await storeTokens(result.access_token, result.refresh_token);
      scheduleRefresh(result.access_token);
      set({
        user: result.user,
        token: result.access_token,
        refreshToken_: result.refresh_token,
        authState: 'authenticated',
      });
    },

    logout: async () => {
      if (refreshTimerId) clearTimeout(refreshTimerId);
      const { refreshToken_: rt } = get();
      if (rt) {
        const trpc = createCentralTrpcClient(get().centralUrl, () => get().token);
        await trpc.auth.logout.mutate({ refresh_token: rt }).catch(() => {});
      }
      await clearTokens();
      set({ user: null, token: null, refreshToken_: null, authState: 'unauthenticated' });
    },

    refreshToken: async () => {
      const rt = get().refreshToken_ ?? (await getStoredRefreshToken());
      if (!rt) {
        set({ authState: 'unauthenticated' });
        return;
      }
      const trpc = createCentralTrpcClient(get().centralUrl, () => null);
      const result = await trpc.auth.refresh.mutate({ refresh_token: rt });
      await storeTokens(result.access_token, rt);
      scheduleRefresh(result.access_token);
      set({ token: result.access_token, refreshToken_: rt });
    },

    setUser: (user) => set({ user }),

    restoreSession: async () => {
      set({ authState: 'loading' });
      try {
        const rt = await getStoredRefreshToken();
        if (!rt) {
          set({ authState: 'unauthenticated' });
          return;
        }
        const trpc = createCentralTrpcClient(get().centralUrl, () => null);
        const result = await trpc.auth.refresh.mutate({ refresh_token: rt });
        await storeTokens(result.access_token, rt);
        scheduleRefresh(result.access_token);
        set({ token: result.access_token, refreshToken_: rt });

        // Fetch user profile
        const userTrpc = createCentralTrpcClient(get().centralUrl, () => result.access_token);
        // Parse user_id from JWT
        const payload = JSON.parse(atob(result.access_token.split('.')[1]!));
        const user = await userTrpc.profile.get.query({ user_id: payload.sub as string });
        set({ user, authState: 'authenticated' });
      } catch {
        set({ authState: 'unauthenticated' });
      }
    },
  };
});
