import { ipcMain, app } from 'electron';

export function registerIpcHandlers() {
  ipcMain.handle('get-version', () => app.getVersion());
  // TODO: Register handlers for persistence, notifications, etc.
}
