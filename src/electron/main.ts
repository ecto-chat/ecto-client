import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import path from 'node:path';
import { registerIpcHandlers } from './ipc-handlers.js';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// Register ecto:// protocol handler (must be called before app.whenReady)
app.setAsDefaultProtocolClient('ecto');

// Ensure single instance — second launches forward their argv to the running instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function handleProtocolUrl(url: string) {
  try {
    // Supports both ecto://invite/abc123 and ecto:invite/abc123
    const pathPart = url.replace(/^ecto:\/?\/?/, '');
    const parts = pathPart.split('/');
    if (parts[0] === 'invite' && parts[1]) {
      mainWindow?.webContents.send('deep-link', { type: 'invite', code: parts[1] });
    }
  } catch {
    // Malformed URL — ignore
  }
}

// macOS: handle protocol URL when app is already running
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleProtocolUrl(url);
});

// Windows/Linux: second instance passes URL via argv
app.on('second-instance', (_event, argv) => {
  const url = argv.find((a) => a.startsWith('ecto://'));
  if (url) handleProtocolUrl(url);
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function createWindow() {
  const iconPath = path.join(__dirname, '../../resources/icon.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 500,
    title: 'Ecto',
    icon: iconPath,
    backgroundColor: '#1a1a2e',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1a1a2e',
      symbolColor: '#ffffff',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  if (process.env['VITE_DEV_SERVER_URL']) {
    mainWindow.loadURL(process.env['VITE_DEV_SERVER_URL']);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const trayIconPath = path.join(__dirname, '../../resources/icon.png');
  const icon = nativeImage.createFromPath(trayIconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Ecto');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
