import {
  ipcMain,
  app,
  safeStorage,
  Notification,
  dialog,
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

  // Push-to-talk (uiohook-napi for keydown+keyup support)
  let pttKeycode: number | null = null;
  let uiohookStarted = false;

  // Map common PTT key names to uiohook keycodes
  const KEY_MAP: Record<string, number> = {
    ' ': 57, Space: 57,
    F13: 100, F14: 101, F15: 102, F16: 103,
    F17: 104, F18: 105, F19: 106, F20: 107,
    F21: 108, F22: 109, F23: 110, F24: 111,
    CapsLock: 58, ScrollLock: 70, Pause: 69,
    Insert: 3639, Delete: 3667, Home: 3655, End: 3663,
    PageUp: 3657, PageDown: 3665,
    NumpadMultiply: 55, NumpadAdd: 78, NumpadSubtract: 74,
    NumpadDecimal: 83, NumpadDivide: 3637,
  };

  ipcMain.handle('ptt:register', (_event, key: string) => {
    pttKeycode = KEY_MAP[key] ?? null;
    if (!pttKeycode) return false;

    if (!uiohookStarted) {
      // Lazy import to avoid loading native module when PTT isn't used
      import('uiohook-napi').then(({ uIOhook }) => {
        uIOhook.on('keydown', (e) => {
          if (e.keycode === pttKeycode) {
            BrowserWindow.getAllWindows()[0]?.webContents.send('ptt:keydown');
          }
        });
        uIOhook.on('keyup', (e) => {
          if (e.keycode === pttKeycode) {
            BrowserWindow.getAllWindows()[0]?.webContents.send('ptt:keyup');
          }
        });
        uIOhook.start();
      });
      uiohookStarted = true;
    }
    return true;
  });

  ipcMain.handle('ptt:unregister', () => {
    pttKeycode = null;
  });

  app.on('will-quit', () => {
    if (uiohookStarted) {
      import('uiohook-napi').then(({ uIOhook }) => uIOhook.stop());
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
