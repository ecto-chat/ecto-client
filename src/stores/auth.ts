import { create } from 'zustand';
import type { GlobalUser } from 'ecto-shared';
import { createCentralTrpcClient } from '../services/trpc.js';
import type { CentralTrpcClient } from '../types/trpc.js';
import { useUiStore } from './ui.js';
import { secureStorage } from '../services/secure-storage.js';
import { preferenceManager } from '../services/preference-manager.js';
import {
  addAccount as registryAddAccount,
  removeAccount as registryRemoveAccount,
  getActiveUserId,
  setActiveUserId,
  getAccounts,
  clearRegistry,
} from '../services/account-registry.js';
import type { AccountEntry } from '../services/account-registry.js';
import { reclaimLegacyData, hasLegacyData } from '../services/preference-migration.js';
import { parseTokenExp } from '../lib/jwt.js';

type AuthState = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
type CentralAuthState = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthStore {
  user: GlobalUser | null;
  token: string | null;
  refreshToken_: string | null;
  authState: AuthState;
  centralAuthState: CentralAuthState;
  centralUrl: string;

  isCentralAuth: () => boolean;
  login: (email: string, password: string) => Promise<void>;
  loginGoogle: (googleToken: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  setUser: (user: GlobalUser) => void;
  restoreSession: () => Promise<void>;
  getToken: () => string | null;
  getCentralTrpc: () => CentralTrpcClient;
  enterLocalOnly: () => void;
  signInToCentralFromModal: (email: string, password: string) => Promise<void>;
  switchAccount: (targetUserId: string) => Promise<void>;
  logoutAll: () => Promise<void>;
}

const DEFAULT_CENTRAL_URL = import.meta.env.VITE_CENTRAL_URL ?? 'http://localhost:4000';

function parseUserId(token: string): string | null {
  try {
    const parts = token.split('.');
    const encoded = parts[1];
    if (!encoded) return null;
    const payload = JSON.parse(atob(encoded)) as Record<string, unknown>;
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthStore>()((set, get) => {
  let refreshTimerId: ReturnType<typeof setTimeout> | null = null;

  // Cross-tab coordination: listen for refresh token updates from other tabs
  const refreshChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ecto-auth-refresh') : null;
  if (refreshChannel) {
    refreshChannel.onmessage = (event: MessageEvent) => {
      const data = event.data as { access_token: string; refresh_token: string } | undefined;
      if (data?.access_token && data?.refresh_token) {
        set({ token: data.access_token, refreshToken_: data.refresh_token });
        scheduleRefresh(data.access_token);
      }
    };
  }

  function scheduleRefresh(token: string) {
    if (refreshTimerId) clearTimeout(refreshTimerId);
    try {
      const encoded = token.split('.')[1];
      if (!encoded) return;
      const payload = JSON.parse(atob(encoded)) as Record<string, unknown>;
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

  async function storeTokens(userId: string, accessToken: string, refreshTok: string) {
    await secureStorage.set(`auth:${userId}:access_token`, accessToken);
    await secureStorage.set(`auth:${userId}:refresh_token`, refreshTok);
  }

  async function clearTokensForUser(userId: string) {
    await secureStorage.deleteByPrefix(`auth:${userId}:`);
  }

  async function getStoredRefreshToken(userId?: string): Promise<string | null> {
    const uid = userId ?? getActiveUserId();
    if (!uid) return null;
    return secureStorage.get(`auth:${uid}:refresh_token`);
  }

  async function hasStoredServerSessions(): Promise<boolean> {
    // Check for server tokens under any user prefix, or legacy key
    const uid = getActiveUserId();
    if (uid) {
      try {
        const raw = await secureStorage.get(`auth:${uid}:server_tokens`);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          if (Object.keys(parsed).length > 0) return true;
        }
      } catch { /* ignore */ }
    }
    // Also check legacy key for backward compatibility
    try {
      const raw = await secureStorage.get('ecto-server-tokens');
      if (!raw) return false;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return Object.keys(parsed).length > 0;
    } catch {
      return false;
    }
  }

  function buildAccountEntry(user: GlobalUser): AccountEntry {
    return {
      userId: user.id,
      username: user.username,
      discriminator: user.discriminator ?? '0000',
      displayName: user.display_name ?? user.username,
      avatarUrl: user.avatar_url ?? null,
      addedAt: Date.now(),
    };
  }

  async function onLoginSuccess(user: GlobalUser, accessToken: string, refreshTok: string) {
    const userId = user.id;

    // Store tokens keyed by userId
    await storeTokens(userId, accessToken, refreshTok);
    scheduleRefresh(accessToken);

    // Update account registry
    registryAddAccount(buildAccountEntry(user));
    setActiveUserId(userId);
    preferenceManager.setActiveUser(userId);

    // Reclaim legacy data if present
    if (hasLegacyData()) {
      reclaimLegacyData(userId);
    }

    set({
      user,
      token: accessToken,
      refreshToken_: refreshTok,
      authState: 'authenticated',
      centralAuthState: 'authenticated',
    });
  }

  return {
    user: null,
    token: null,
    refreshToken_: null,
    authState: 'idle',
    centralAuthState: 'idle',
    centralUrl: DEFAULT_CENTRAL_URL,

    getToken: () => get().token,

    isCentralAuth: () => get().centralAuthState === 'authenticated',

    getCentralTrpc: () => createCentralTrpcClient(get().centralUrl, () => get().token),

    enterLocalOnly: () => {
      set({
        authState: 'authenticated',
        centralAuthState: 'unauthenticated',
      });
    },

    login: async (email, password) => {
      set({ authState: 'loading', centralAuthState: 'loading' });
      const trpc = createCentralTrpcClient(get().centralUrl, () => null);
      const result = await trpc.auth.login.mutate({ email, password });
      await onLoginSuccess(result.user, result.access_token, result.refresh_token);
    },

    loginGoogle: async (googleToken) => {
      set({ authState: 'loading', centralAuthState: 'loading' });
      const trpc = createCentralTrpcClient(get().centralUrl, () => null);
      const result = await trpc.auth.loginGoogle.mutate({ google_token: googleToken });
      await onLoginSuccess(result.user, result.access_token, result.refresh_token);
    },

    register: async (email, password, username) => {
      set({ authState: 'loading', centralAuthState: 'loading' });
      const trpc = createCentralTrpcClient(get().centralUrl, () => null);
      const result = await trpc.auth.register.mutate({ email, password, username });
      await onLoginSuccess(result.user, result.access_token, result.refresh_token);
    },

    logout: async () => {
      if (refreshTimerId) clearTimeout(refreshTimerId);
      const { refreshToken_: rt, user } = get();
      const userId = user?.id;

      // Revoke token server-side (best effort)
      if (rt) {
        const trpc = createCentralTrpcClient(get().centralUrl, () => get().token);
        await trpc.auth.logout.mutate({ refresh_token: rt }).catch(() => {});
      }

      // Clear user data
      if (userId) {
        await clearTokensForUser(userId);
        preferenceManager.clearUserData(userId);
        registryRemoveAccount(userId);
      }

      set({
        user: null,
        token: null,
        refreshToken_: null,
        authState: 'unauthenticated',
        centralAuthState: 'unauthenticated',
      });
    },

    refreshToken: async () => {
      const doRefresh = async () => {
        const rt = get().refreshToken_ ?? (await getStoredRefreshToken());
        if (!rt) {
          set({ authState: 'unauthenticated' });
          return;
        }
        try {
          const trpc = createCentralTrpcClient(get().centralUrl, () => null);
          const result = await trpc.auth.refresh.mutate({ refresh_token: rt });

          const userId = parseUserId(result.access_token);
          if (userId) {
            await storeTokens(userId, result.access_token, result.refresh_token);
          }
          scheduleRefresh(result.access_token);
          set({ token: result.access_token, refreshToken_: result.refresh_token });

          // Broadcast to other tabs so they don't refresh with the old (now-replaced) token
          refreshChannel?.postMessage({ access_token: result.access_token, refresh_token: result.refresh_token });
        } catch (err: unknown) {
          // Check for refresh token reuse — force re-login
          const tErr = err as { data?: { ecto_code?: number } };
          if (tErr.data?.ecto_code === 1009) {
            const userId = getActiveUserId();
            if (userId) await clearTokensForUser(userId);
            set({ authState: 'unauthenticated', centralAuthState: 'unauthenticated', token: null, refreshToken_: null, user: null });
            return;
          }
          throw err;
        }
      };

      // Use Web Locks to prevent multiple tabs from refreshing the same token simultaneously
      if (typeof navigator !== 'undefined' && navigator.locks) {
        await navigator.locks.request('ecto-token-refresh', doRefresh);
      } else {
        await doRefresh();
      }
    },

    setUser: (user) => set({ user }),

    restoreSession: async () => {
      set({ authState: 'loading', centralAuthState: 'loading' });

      // Check account registry first
      const activeUserId = getActiveUserId();
      if (activeUserId) {
        preferenceManager.setActiveUser(activeUserId);
        useUiStore.getState().hydrateFromPreferences();
      }

      try {
        const rt = await getStoredRefreshToken(activeUserId ?? undefined);
        if (!rt) {
          // No Central refresh token — check for stored server sessions (Branch B)
          if (await hasStoredServerSessions()) {
            set({
              authState: 'authenticated',
              centralAuthState: 'unauthenticated',
            });
          } else {
            // Nothing stored at all (Branch C — show LandingPage)
            set({ authState: 'unauthenticated', centralAuthState: 'unauthenticated' });
          }
          return;
        }

        // Phase 4.3: Skip auth.refresh if stored access token is still valid
        if (activeUserId) {
          const storedAccessToken = await secureStorage.get(`auth:${activeUserId}:access_token`);
          if (storedAccessToken) {
            const exp = parseTokenExp(storedAccessToken);
            if (exp && exp * 1000 - Date.now() > 30_000) {
              // Access token still valid — skip refresh
              set({ token: storedAccessToken, refreshToken_: rt });
              scheduleRefresh(storedAccessToken);

              // Phase 4.2: Use cached profile for instant render
              const cachedUser = preferenceManager.getUserFor(activeUserId, 'cached-profile', null) as GlobalUser | null;
              if (cachedUser) {
                set({ user: cachedUser, authState: 'authenticated', centralAuthState: 'authenticated' });
                // Background refresh of profile
                const userTrpc = createCentralTrpcClient(get().centralUrl, () => storedAccessToken);
                userTrpc.profile.get.query({ user_id: activeUserId }).then((u) => {
                  set({ user: u });
                  preferenceManager.setUser('cached-profile', u);
                }).catch(() => {});
                return;
              }

              // No cached profile — fetch it but don't block on refresh
              const userTrpc = createCentralTrpcClient(get().centralUrl, () => storedAccessToken);
              const user = await userTrpc.profile.get.query({ user_id: activeUserId });
              registryAddAccount(buildAccountEntry(user));
              setActiveUserId(activeUserId);
              set({ user, authState: 'authenticated', centralAuthState: 'authenticated' });
              preferenceManager.setUser('cached-profile', user);
              return;
            }
          }
        }

        // Fallthrough: access token expired or missing — do full refresh
        const trpc = createCentralTrpcClient(get().centralUrl, () => null);
        const result = await trpc.auth.refresh.mutate({ refresh_token: rt });

        const userId = parseUserId(result.access_token);
        if (userId) {
          await storeTokens(userId, result.access_token, result.refresh_token);
          preferenceManager.setActiveUser(userId);
        }
        scheduleRefresh(result.access_token);
        set({ token: result.access_token, refreshToken_: result.refresh_token });

        // Fetch user profile
        const userTrpc = createCentralTrpcClient(get().centralUrl, () => result.access_token);
        const uid = parseUserId(result.access_token);
        if (!uid) throw new Error('Invalid access token');
        const user = await userTrpc.profile.get.query({ user_id: uid });

        // Update registry with latest user info
        registryAddAccount(buildAccountEntry(user));
        setActiveUserId(uid);
        preferenceManager.setUser('cached-profile', user);

        set({ user, authState: 'authenticated', centralAuthState: 'authenticated' });
      } catch {
        // Central refresh failed — check for stored server sessions (Branch B)
        if (await hasStoredServerSessions()) {
          set({
            authState: 'authenticated',
            centralAuthState: 'unauthenticated',
          });
        } else {
          set({ authState: 'unauthenticated', centralAuthState: 'unauthenticated' });
        }
      }
    },

    signInToCentralFromModal: async (email, password) => {
      set({ centralAuthState: 'loading' });
      try {
        const trpc = createCentralTrpcClient(get().centralUrl, () => null);
        const result = await trpc.auth.login.mutate({ email, password });

        const userId = parseUserId(result.access_token);
        if (userId) {
          await storeTokens(userId, result.access_token, result.refresh_token);
          preferenceManager.setActiveUser(userId);
        }
        scheduleRefresh(result.access_token);

        // Fetch user profile
        const userTrpc = createCentralTrpcClient(get().centralUrl, () => result.access_token);
        const modalUid = parseUserId(result.access_token);
        if (!modalUid) throw new Error('Invalid access token');
        const user = await userTrpc.profile.get.query({ user_id: modalUid });

        // Update registry
        registryAddAccount(buildAccountEntry(user));
        setActiveUserId(modalUid);

        // Reclaim legacy data if present
        if (hasLegacyData()) {
          reclaimLegacyData(modalUid);
        }

        set({
          user,
          token: result.access_token,
          refreshToken_: result.refresh_token,
          centralAuthState: 'authenticated',
        });
      } catch (err) {
        set({ centralAuthState: 'unauthenticated' });
        throw err;
      }
    },

    switchAccount: async (targetUserId: string) => {
      if (refreshTimerId) clearTimeout(refreshTimerId);

      // Save current navigation state
      const currentActiveServer = useUiStore.getState().activeServerId;
      if (currentActiveServer) {
        preferenceManager.setUser('last-active-server', currentActiveServer);
      }

      // Set the target as active
      setActiveUserId(targetUserId);
      preferenceManager.setActiveUser(targetUserId);

      // Restore session for the target account
      set({
        user: null,
        token: null,
        refreshToken_: null,
        authState: 'loading',
        centralAuthState: 'loading',
      });

      try {
        const rt = await getStoredRefreshToken(targetUserId);
        if (!rt) {
          throw new Error('No refresh token for account');
        }

        const trpc = createCentralTrpcClient(get().centralUrl, () => null);
        const result = await trpc.auth.refresh.mutate({ refresh_token: rt });
        await storeTokens(targetUserId, result.access_token, result.refresh_token);
        scheduleRefresh(result.access_token);

        // Fetch user profile
        const userTrpc = createCentralTrpcClient(get().centralUrl, () => result.access_token);
        const user = await userTrpc.profile.get.query({ user_id: targetUserId });

        // Update registry with fresh info
        registryAddAccount(buildAccountEntry(user));

        set({
          user,
          token: result.access_token,
          refreshToken_: result.refresh_token,
          authState: 'authenticated',
          centralAuthState: 'authenticated',
        });
      } catch {
        // Refresh failed — remove the broken account
        registryRemoveAccount(targetUserId);
        await clearTokensForUser(targetUserId);
        preferenceManager.clearUserData(targetUserId);

        // Try next account or go to unauthenticated
        const remaining = getAccounts();
        const nextAccount = remaining[0];
        if (nextAccount) {
          await get().switchAccount(nextAccount.userId);
        } else {
          preferenceManager.setActiveUser(null);
          set({
            authState: 'unauthenticated',
            centralAuthState: 'unauthenticated',
          });
        }
      }
    },

    logoutAll: async () => {
      if (refreshTimerId) clearTimeout(refreshTimerId);

      // Revoke all tokens (best effort)
      const accounts = getAccounts();
      const trpc = createCentralTrpcClient(get().centralUrl, () => get().token);
      await Promise.allSettled(
        accounts.map(async (account) => {
          const rt = await getStoredRefreshToken(account.userId);
          if (rt) {
            await trpc.auth.logout.mutate({ refresh_token: rt }).catch(() => {});
          }
        }),
      );

      // Clear all user data and session data
      for (const account of accounts) {
        await clearTokensForUser(account.userId);
      }
      preferenceManager.clearAllUserData();
      preferenceManager.setActiveUser(null);
      clearRegistry();

      set({
        user: null,
        token: null,
        refreshToken_: null,
        authState: 'unauthenticated',
        centralAuthState: 'unauthenticated',
      });
    },
  };
});
