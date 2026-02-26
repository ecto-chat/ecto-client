import { secureStorage } from './secure-storage.js';
import { getActiveUserId } from './account-registry.js';

interface StoredServerSession {
  address: string;
  token: string;
  tokenExp?: number;
  serverName?: string;
  serverIcon?: string | null;
  defaultChannelId?: string | null;
}

function serverTokensKey(userId?: string): string {
  const uid = userId ?? getActiveUserId();
  if (uid) return `auth:${uid}:server_tokens`;
  return 'ecto-server-tokens'; // legacy fallback
}

function localCredentialsKey(userId?: string): string {
  const uid = userId ?? getActiveUserId();
  if (uid) return `auth:${uid}:local_credentials`;
  return 'ecto-local-credentials'; // legacy fallback
}

export async function getStoredServerSessions(userId?: string): Promise<Array<{
  id: string;
  address: string;
  token: string;
  tokenExp?: number;
  serverName?: string;
  serverIcon?: string | null;
  defaultChannelId?: string | null;
}>> {
  try {
    const raw = await secureStorage.get(serverTokensKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, StoredServerSession>;
    return Object.entries(parsed).map(([id, session]) => ({
      id,
      address: session.address,
      token: session.token,
      tokenExp: session.tokenExp,
      serverName: session.serverName,
      serverIcon: session.serverIcon,
      defaultChannelId: session.defaultChannelId,
    }));
  } catch {
    return [];
  }
}

export async function storeServerSession(
  serverId: string,
  address: string,
  token: string,
  meta?: { tokenExp?: number; serverName?: string; serverIcon?: string | null; defaultChannelId?: string | null },
  userId?: string,
): Promise<void> {
  try {
    const key = serverTokensKey(userId);
    const raw = await secureStorage.get(key);
    const sessions: Record<string, StoredServerSession> = raw ? JSON.parse(raw) as Record<string, StoredServerSession> : {};
    sessions[serverId] = {
      address,
      token,
      ...(meta?.tokenExp !== undefined && { tokenExp: meta.tokenExp }),
      ...(meta?.serverName !== undefined && { serverName: meta.serverName }),
      ...(meta?.serverIcon !== undefined && { serverIcon: meta.serverIcon }),
      ...(meta?.defaultChannelId !== undefined && { defaultChannelId: meta.defaultChannelId }),
    };
    await secureStorage.set(key, JSON.stringify(sessions));
  } catch {
    // Storage full or unavailable
  }
}

/** Update cached metadata for a stored server session without re-storing the token. */
export async function updateStoredServerMeta(
  serverId: string,
  meta: { serverName?: string; serverIcon?: string | null; defaultChannelId?: string | null; tokenExp?: number },
  userId?: string,
): Promise<void> {
  try {
    const key = serverTokensKey(userId);
    const raw = await secureStorage.get(key);
    if (!raw) return;
    const sessions: Record<string, StoredServerSession> = JSON.parse(raw) as Record<string, StoredServerSession>;
    const session = sessions[serverId];
    if (!session) return;
    if (meta.serverName !== undefined) session.serverName = meta.serverName;
    if (meta.serverIcon !== undefined) session.serverIcon = meta.serverIcon;
    if (meta.defaultChannelId !== undefined) session.defaultChannelId = meta.defaultChannelId;
    if (meta.tokenExp !== undefined) session.tokenExp = meta.tokenExp;
    await secureStorage.set(key, JSON.stringify(sessions));
  } catch {
    // Storage unavailable
  }
}

export async function removeStoredServerSession(serverId: string, userId?: string): Promise<void> {
  try {
    const key = serverTokensKey(userId);
    const raw = await secureStorage.get(key);
    if (!raw) return;
    const sessions: Record<string, StoredServerSession> = JSON.parse(raw) as Record<string, StoredServerSession>;
    const { [serverId]: _, ...rest } = sessions;
    await secureStorage.set(key, JSON.stringify(rest));
  } catch {
    // Storage unavailable
  }
}

export async function clearStoredServerSessions(userId?: string): Promise<void> {
  await secureStorage.delete(serverTokensKey(userId));
}

export async function storeLocalCredentials(username: string, password: string, userId?: string): Promise<void> {
  try {
    await secureStorage.set(localCredentialsKey(userId), JSON.stringify({ username, password }));
  } catch {
    // Storage full or unavailable
  }
}

export async function getStoredLocalCredentials(userId?: string): Promise<{ username: string; password: string } | null> {
  try {
    const raw = await secureStorage.get(localCredentialsKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as { username: string; password: string };
  } catch {
    return null;
  }
}

export async function clearLocalCredentials(userId?: string): Promise<void> {
  await secureStorage.delete(localCredentialsKey(userId));
}

/**
 * Update the stored session token for a server after a password change.
 * Call this when the server returns a new token from members.changePassword.
 */
export async function updateServerSessionToken(serverId: string, newToken: string, userId?: string): Promise<void> {
  try {
    const key = serverTokensKey(userId);
    const raw = await secureStorage.get(key);
    if (!raw) return;
    const sessions: Record<string, StoredServerSession> = JSON.parse(raw) as Record<string, StoredServerSession>;
    const session = sessions[serverId];
    if (session) {
      sessions[serverId] = { ...session, token: newToken };
      await secureStorage.set(key, JSON.stringify(sessions));
    }
  } catch {
    // Storage unavailable
  }
}
