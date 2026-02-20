/**
 * Account registry — tracks which Ecto Central accounts are signed in on this device.
 * Stored in localStorage under `ecto.accounts` as JSON.
 */

const REGISTRY_KEY = 'ecto.accounts';
const MAX_ACCOUNTS = 5;

export interface AccountEntry {
  userId: string;
  username: string;
  discriminator: string;
  displayName: string;
  avatarUrl: string | null;
  addedAt: number;
}

interface AccountRegistry {
  accounts: AccountEntry[];
  activeUserId: string | null;
}

function loadRegistry(): AccountRegistry {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (raw) return JSON.parse(raw) as AccountRegistry;
  } catch { /* ignore */ }
  return { accounts: [], activeUserId: null };
}

function saveRegistry(registry: AccountRegistry): void {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
}

export function getAccounts(): AccountEntry[] {
  return loadRegistry().accounts;
}

export function getActiveUserId(): string | null {
  return loadRegistry().activeUserId;
}

export function setActiveUserId(userId: string | null): void {
  const registry = loadRegistry();
  registry.activeUserId = userId;
  saveRegistry(registry);
}

export function addAccount(entry: AccountEntry): void {
  const registry = loadRegistry();
  const existing = registry.accounts.findIndex((a) => a.userId === entry.userId);
  if (existing !== -1) {
    // Upsert — update display info
    const current = registry.accounts[existing];
    if (current) registry.accounts[existing] = { ...current, ...entry };
  } else {
    if (registry.accounts.length >= MAX_ACCOUNTS) {
      throw new Error(`Maximum ${MAX_ACCOUNTS} accounts. Remove one to add another.`);
    }
    registry.accounts.push(entry);
  }
  saveRegistry(registry);
}

export function removeAccount(userId: string): void {
  const registry = loadRegistry();
  registry.accounts = registry.accounts.filter((a) => a.userId !== userId);
  if (registry.activeUserId === userId) {
    registry.activeUserId = registry.accounts[0]?.userId ?? null;
  }
  saveRegistry(registry);
}

export function clearRegistry(): void {
  saveRegistry({ accounts: [], activeUserId: null });
}

export function getAccountCount(): number {
  return loadRegistry().accounts.length;
}
