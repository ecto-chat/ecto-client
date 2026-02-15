import { connectionManager } from './connection-manager.js';
import { usePresenceStore } from '../stores/presence.js';
import { useAuthStore } from '../stores/auth.js';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

let idleTimer: ReturnType<typeof setTimeout> | null = null;
let wasAutoIdled = false;
let initialized = false;

function resetTimer() {
  if (idleTimer !== null) {
    clearTimeout(idleTimer);
  }

  // If we were auto-idled, restore to online
  if (wasAutoIdled) {
    wasAutoIdled = false;
    const user = useAuthStore.getState().user;
    if (user) {
      usePresenceStore.getState().setPresence(user.id, 'online');
      const centralWs = connectionManager.getCentralWs();
      centralWs?.updatePresence('online');
    }
  }

  idleTimer = setTimeout(() => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    const current = usePresenceStore.getState().presences.get(user.id);
    const status = current?.status ?? 'online';

    // Only auto-idle if currently online (don't override manual DND/idle/invisible)
    if (status === 'online') {
      wasAutoIdled = true;
      usePresenceStore.getState().setPresence(user.id, 'idle');
      const centralWs = connectionManager.getCentralWs();
      centralWs?.updatePresence('idle');
    }
  }, IDLE_TIMEOUT_MS);
}

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'] as const;

export function startIdleDetection() {
  if (initialized) return;
  initialized = true;

  for (const event of ACTIVITY_EVENTS) {
    window.addEventListener(event, resetTimer, { passive: true });
  }

  resetTimer();
}

export function stopIdleDetection() {
  if (!initialized) return;
  initialized = false;

  for (const event of ACTIVITY_EVENTS) {
    window.removeEventListener(event, resetTimer);
  }

  if (idleTimer !== null) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }

  wasAutoIdled = false;
}
