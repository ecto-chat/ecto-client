/**
 * Centralized preference storage with device/user tier separation.
 * Replaces all direct localStorage.getItem/setItem calls across the codebase.
 */

class PreferenceManager {
  private activeUserId: string | null = null;

  setActiveUser(userId: string | null): void {
    this.activeUserId = userId;
  }

  getActiveUser(): string | null {
    return this.activeUserId;
  }

  // ── Device Tier ────────────────────────────────────

  getDevice<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`ecto.device.${key}`);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  setDevice<T>(key: string, value: T): void {
    localStorage.setItem(`ecto.device.${key}`, JSON.stringify(value));
  }

  removeDevice(key: string): void {
    localStorage.removeItem(`ecto.device.${key}`);
  }

  // ── User Tier ──────────────────────────────────────

  getUser<T>(key: string, fallback: T): T {
    if (!this.activeUserId) return fallback;
    return this.getUserFor(this.activeUserId, key, fallback);
  }

  setUser<T>(key: string, value: T): void {
    if (!this.activeUserId) return;
    localStorage.setItem(`ecto.user.${this.activeUserId}.${key}`, JSON.stringify(value));
  }

  removeUser(key: string): void {
    if (!this.activeUserId) return;
    localStorage.removeItem(`ecto.user.${this.activeUserId}.${key}`);
  }

  getUserFor<T>(userId: string, key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`ecto.user.${userId}.${key}`);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  // ── Cleanup ────────────────────────────────────────

  clearUserData(userId: string): void {
    const prefix = `ecto.user.${userId}.`;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  }

  clearAllUserData(): void {
    const prefix = 'ecto.user.';
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  }
}

// Repair double-encoded boolean values from buggy migration v1.
// Must run at module scope BEFORE any store reads getDevice().
(function repairDoubleEncoded() {
  if (localStorage.getItem('ecto.migrated.v2') === '1') return;
  const booleanKeys = ['sidebar-collapsed', 'member-list-visible', 'bypass-nsfw', 'ptt-enabled'];
  for (const key of booleanKeys) {
    const fullKey = `ecto.device.${key}`;
    const raw = localStorage.getItem(fullKey);
    if (raw === '"true"') localStorage.setItem(fullKey, 'true');
    else if (raw === '"false"') localStorage.setItem(fullKey, 'false');
  }
  localStorage.setItem('ecto.migrated.v2', '1');
})();

export const preferenceManager = new PreferenceManager();
