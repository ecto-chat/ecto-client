import {
  ipcMain,
  app,
  safeStorage,
  Notification,
  dialog,
  globalShortcut,
  BrowserWindow,
} from 'electron';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const STORE_PATH = join(app.getPath('userData'), 'secure-store.enc');

function loadStore(): Map<string, string> {
  if (!existsSync(STORE_PATH)) return new Map();
  try {
    const encrypted = readFileSync(STORE_PATH);
    if (!safeStorage.isEncryptionAvailable()) return new Map();
    const decrypted = safeStorage.decryptString(encrypted);
    const parsed = JSON.parse(decrypted) as Record<string, string>;
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

function saveStore(data: Map<string, string>): void {
  try {
    const obj = Object.fromEntries(data);
    const json = JSON.stringify(obj);
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(json);
      writeFileSync(STORE_PATH, encrypted);
    } else {
      writeFileSync(STORE_PATH, json);
    }
  } catch {
    // Write failed — storage unavailable
  }
}

const store = loadStore();

export function registerIpcHandlers() {
  ipcMain.handle('get-version', () => app.getVersion());

  // Secure store using safeStorage + encrypted disk persistence
  ipcMain.handle('secure-store:get', (_event, key: string) => {
    return store.get(key) ?? null;
  });

  ipcMain.handle('secure-store:set', (_event, key: string, value: string) => {
    store.set(key, value);
    saveStore(store);
  });

  ipcMain.handle('secure-store:delete', (_event, key: string) => {
    store.delete(key);
    saveStore(store);
  });

  ipcMain.handle('secure-store:delete-by-prefix', (_event, prefix: string) => {
    let changed = false;
    for (const key of [...store.keys()]) {
      if (key.startsWith(prefix)) {
        store.delete(key);
        changed = true;
      }
    }
    if (changed) saveStore(store);
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
