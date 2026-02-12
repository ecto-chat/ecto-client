import {
  ipcMain,
  app,
  safeStorage,
  Notification,
  dialog,
  globalShortcut,
  BrowserWindow,
} from 'electron';
import { writeFile } from 'node:fs/promises';

const store = new Map<string, Buffer>();

export function registerIpcHandlers() {
  ipcMain.handle('get-version', () => app.getVersion());

  // Secure store using safeStorage
  ipcMain.handle('secure-store:get', (_event, key: string) => {
    const encrypted = store.get(key);
    if (!encrypted) return null;
    if (!safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.decryptString(encrypted);
  });

  ipcMain.handle('secure-store:set', (_event, key: string, value: string) => {
    if (!safeStorage.isEncryptionAvailable()) {
      store.set(key, Buffer.from(value));
      return;
    }
    store.set(key, safeStorage.encryptString(value));
  });

  ipcMain.handle('secure-store:delete', (_event, key: string) => {
    store.delete(key);
  });

  // Notifications
  ipcMain.handle(
    'notify:show',
    (_event, title: string, body: string, data?: Record<string, string>) => {
      const notification = new Notification({ title, body });
      notification.on('click', () => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
          win.show();
          win.focus();
          if (data) {
            win.webContents.send('notify:click', data);
          }
        }
      });
      notification.show();
    },
  );

  ipcMain.handle('tray:badge', (_event, count: number) => {
    if (process.platform === 'darwin') {
      app.dock?.setBadge(count > 0 ? String(count) : '');
    }
    // On Windows/Linux, badge is handled via tray overlay or title
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      win.setTitle(count > 0 ? `(${count}) Ecto` : 'Ecto');
    }
  });

  // Window controls
  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.handle('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });

  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  // Push-to-talk
  let registeredPttKey: string | null = null;

  ipcMain.handle('ptt:register', (_event, key: string) => {
    if (registeredPttKey) {
      globalShortcut.unregister(registeredPttKey);
    }
    registeredPttKey = key;
    try {
      globalShortcut.register(key, () => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send('ptt:keydown');
      });
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('ptt:unregister', () => {
    if (registeredPttKey) {
      globalShortcut.unregister(registeredPttKey);
      registeredPttKey = null;
    }
  });

  // Theme CSS injection
  ipcMain.handle('theme:inject-css', async (event, css: string) => {
    return event.sender.insertCSS(css);
  });

  ipcMain.handle('theme:remove-css', async (event, key: string) => {
    await event.sender.removeInsertedCSS(key);
  });

  // File save
  ipcMain.handle('file:save', async (_event, data: ArrayBuffer, filename: string) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return null;
    const result = await dialog.showSaveDialog(win, {
      defaultPath: filename,
    });
    if (result.canceled || !result.filePath) return null;
    await writeFile(result.filePath, Buffer.from(data));
    return result.filePath;
  });
}
