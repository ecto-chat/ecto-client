import { secureStorage } from './secure-storage.js';

const SERVER_TOKENS_KEY = 'ecto-server-tokens';
const LOCAL_CREDENTIALS_KEY = 'ecto-local-credentials';

interface StoredServerSession {
  address: string;
  token: string;
}

export async function getStoredServerSessions(): Promise<Array<{ id: string; address: string; token: string }>> {
  try {
    const raw = await secureStorage.get(SERVER_TOKENS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, StoredServerSession>;
    return Object.entries(parsed).map(([id, session]) => ({
      id,
      address: session.address,
      token: session.token,
    }));
  } catch {
    return [];
  }
}

export async function storeServerSession(serverId: string, address: string, token: string): Promise<void> {
  try {
    const raw = await secureStorage.get(SERVER_TOKENS_KEY);
    const sessions: Record<string, StoredServerSession> = raw ? JSON.parse(raw) as Record<string, StoredServerSession> : {};
    sessions[serverId] = { address, token };
    await secureStorage.set(SERVER_TOKENS_KEY, JSON.stringify(sessions));
  } catch {
    // Storage full or unavailable
  }
}

export async function removeStoredServerSession(serverId: string): Promise<void> {
  try {
    const raw = await secureStorage.get(SERVER_TOKENS_KEY);
    if (!raw) return;
    const sessions: Record<string, StoredServerSession> = JSON.parse(raw) as Record<string, StoredServerSession>;
    delete sessions[serverId];
    await secureStorage.set(SERVER_TOKENS_KEY, JSON.stringify(sessions));
  } catch {
    // Storage unavailable
  }
}

export async function clearStoredServerSessions(): Promise<void> {
  await secureStorage.delete(SERVER_TOKENS_KEY);
}

export async function storeLocalCredentials(username: string, password: string): Promise<void> {
  try {
    await secureStorage.set(LOCAL_CREDENTIALS_KEY, JSON.stringify({ username, password }));
  } catch {
    // Storage full or unavailable
  }
}

export async function getStoredLocalCredentials(): Promise<{ username: string; password: string } | null> {
  try {
    const raw = await secureStorage.get(LOCAL_CREDENTIALS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { username: string; password: string };
  } catch {
    return null;
  }
}

export async function clearLocalCredentials(): Promise<void> {
  await secureStorage.delete(LOCAL_CREDENTIALS_KEY);
}
