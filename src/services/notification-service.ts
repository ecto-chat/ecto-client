const STORAGE_KEY = 'ecto-notification-settings';

interface NotificationPrefs {
  enabled: boolean;
  showDMs: boolean;
  showMentions: boolean;
  showEveryone: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  enabled: true,
  showDMs: true,
  showMentions: true,
  showEveryone: false,
};

function getPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
      return { ...DEFAULT_PREFS, ...parsed };
    }
  } catch {
    // Ignore parse errors
  }
  return { ...DEFAULT_PREFS };
}

// Global click handler — registered from React with access to the router
let clickHandler: ((data: Record<string, string>) => void) | null = null;
let electronCleanup: (() => void) | null = null;

export function setNotificationClickHandler(handler: (data: Record<string, string>) => void): () => void {
  clickHandler = handler;

  // Wire up Electron IPC click events
  if (window.electronAPI) {
    electronCleanup?.();
    electronCleanup = window.electronAPI.notifications.onNotificationClick(handler);
  }

  return () => {
    clickHandler = null;
    electronCleanup?.();
    electronCleanup = null;
  };
}

export function showOsNotification(
  title: string,
  body: string,
  data?: Record<string, string>,
): void {
  const prefs = getPrefs();
  if (!prefs.enabled) return;
  if (document.hasFocus()) return;

  if (window.electronAPI) {
    window.electronAPI.notifications.showNotification(title, body, data);
  } else if ('Notification' in window && Notification.permission === 'granted') {
    const n = new Notification(title, { body, tag: data?.type ?? 'ecto' });
    n.onclick = () => {
      window.focus();
      if (data && clickHandler) {
        clickHandler(data);
      }
    };
  }
}

export function shouldNotifyDM(): boolean {
  return getPrefs().showDMs;
}

export function shouldNotifyMention(): boolean {
  return getPrefs().showMentions;
}

export function shouldNotifyEveryone(): boolean {
  return getPrefs().showEveryone;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (window.electronAPI) return true;
  if (!('Notification' in window)) return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}
