/**
 * Cross-environment storage abstraction.
 * Uses Electron's encrypted store when available, falls back to localStorage.
 */

declare const window: {
  electronAPI?: {
    secureStore: {
      get(key: string): Promise<string | null>;
      set(key: string, value: string): Promise<void>;
      delete(key: string): Promise<void>;
      deleteByPrefix(prefix: string): Promise<void>;
    };
  };
  localStorage: Storage;
};

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    if (window.electronAPI?.secureStore) {
      return window.electronAPI.secureStore.get(key);
    }
    return localStorage.getItem(key);
  },

  async set(key: string, value: string): Promise<void> {
    if (window.electronAPI?.secureStore) {
      await window.electronAPI.secureStore.set(key, value);
    } else {
      localStorage.setItem(key, value);
    }
  },

  async delete(key: string): Promise<void> {
    if (window.electronAPI?.secureStore) {
      await window.electronAPI.secureStore.delete(key);
    } else {
      localStorage.removeItem(key);
    }
  },

  async deleteByPrefix(prefix: string): Promise<void> {
    if (window.electronAPI?.secureStore) {
      await window.electronAPI.secureStore.deleteByPrefix(prefix);
    } else {
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
  },
};
