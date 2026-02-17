interface ElectronSecureStore {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
}

interface ElectronNotifications {
  showNotification: (title: string, body: string, data?: Record<string, string>) => Promise<void>;
  showBadge: (count: number) => Promise<void>;
  onNotificationClick: (callback: (data: Record<string, string>) => void) => () => void;
}

interface ElectronWindow {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
}

interface ElectronPTT {
  registerShortcut: (key: string) => Promise<boolean>;
  unregisterShortcut: () => Promise<void>;
  onKeyDown: (callback: () => void) => () => void;
  onKeyUp: (callback: () => void) => () => void;
}

interface ElectronTheme {
  injectCSS: (css: string) => Promise<string>;
  removeCSS: (key: string) => Promise<void>;
}

interface ElectronFiles {
  saveFile: (data: ArrayBuffer, filename: string) => Promise<string | null>;
}

interface ElectronAPI {
  getVersion: () => Promise<string>;
  secureStore: ElectronSecureStore;
  notifications: ElectronNotifications;
  window: ElectronWindow;
  ptt: ElectronPTT;
  theme: ElectronTheme;
  files: ElectronFiles;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
