import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('get-version'),

  secureStore: {
    get: (key: string) => ipcRenderer.invoke('secure-store:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('secure-store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('secure-store:delete', key),
    deleteByPrefix: (prefix: string) => ipcRenderer.invoke('secure-store:delete-by-prefix', prefix),
  },

  notifications: {
    showNotification: (title: string, body: string, data?: Record<string, string>) =>
      ipcRenderer.invoke('notify:show', title, body, data),
    showBadge: (count: number) => ipcRenderer.invoke('tray:badge', count),
    onNotificationClick: (callback: (data: Record<string, string>) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: Record<string, string>) => callback(data);
      ipcRenderer.on('notify:click', handler);
      return () => ipcRenderer.removeListener('notify:click', handler);
    },
  },

  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },

  ptt: {
    registerShortcut: (key: string) => ipcRenderer.invoke('ptt:register', key),
    unregisterShortcut: () => ipcRenderer.invoke('ptt:unregister'),
    onKeyDown: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('ptt:keydown', handler);
      return () => ipcRenderer.removeListener('ptt:keydown', handler);
    },
    onKeyUp: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('ptt:keyup', handler);
      return () => ipcRenderer.removeListener('ptt:keyup', handler);
    },
  },

  theme: {
    injectCSS: (css: string) => ipcRenderer.invoke('theme:inject-css', css),
    removeCSS: (key: string) => ipcRenderer.invoke('theme:remove-css', key),
  },

  files: {
    saveFile: (data: ArrayBuffer, filename: string) =>
      ipcRenderer.invoke('file:save', data, filename),
  },
});
