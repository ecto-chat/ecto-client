/**
 * One-time migration of legacy flat localStorage keys to the new tiered format.
 * Runs once at app startup before any store initialization.
 */

function tryParse(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function migrateKey(oldKey: string, newKey: string): void {
  const value = localStorage.getItem(oldKey);
  if (value !== null && localStorage.getItem(newKey) === null) {
    // Old values are already serialized (e.g. "true", '["a","b"]'), copy as-is
    localStorage.setItem(newKey, value);
  }
}

function setIfAbsent(key: string, value: unknown): void {
  if (localStorage.getItem(key) === null) {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

function extractUserIdFromStoredToken(): string | null {
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  try {
    const parts = token.split('.');
    const encoded = parts[1];
    if (!encoded) return null;
    const payload = JSON.parse(atob(encoded)) as Record<string, unknown>;
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

export function migrateFromLegacy(): void {
  if (localStorage.getItem('ecto.migrated') === '1') return;

  const userId = extractUserIdFromStoredToken();

  // ── Migrate Device Tier ───────────────────────────
  migrateKey('ecto-ptt-enabled', 'ecto.device.ptt-enabled');
  migrateKey('ecto-ptt-key', 'ecto.device.ptt-key');
  migrateKey('ecto-bypass-nsfw', 'ecto.device.bypass-nsfw');
  migrateKey('ecto-snapped-width', 'ecto.device.snapped-width');
  migrateKey('ecto-audio-device', 'ecto.device.audio-input');
  migrateKey('ecto-audio-output', 'ecto.device.audio-output');
  migrateKey('ecto-video-device', 'ecto.device.video-input');
  migrateKey('ecto-video-quality', 'ecto.device.video-quality');
  migrateKey('ecto-screen-quality', 'ecto.device.screen-quality');
  migrateKey('ecto-notification-dismissed', 'ecto.device.notification-prompt-dismissed');

  // Decompose ecto-ui persist blob into individual device keys
  const uiRaw = localStorage.getItem('ecto-ui');
  const uiWrapper = tryParse(uiRaw);
  const uiBlob = uiWrapper ? (tryParse(uiWrapper.state as string | null) ?? uiWrapper.state as Record<string, unknown> | null) : null;
  if (uiBlob && typeof uiBlob === 'object') {
    if (uiBlob.sidebarCollapsed != null) setIfAbsent('ecto.device.sidebar-collapsed', uiBlob.sidebarCollapsed);
    if (uiBlob.memberListVisible != null) setIfAbsent('ecto.device.member-list-visible', uiBlob.memberListVisible);
    if (uiBlob.theme != null) setIfAbsent('ecto.device.theme', uiBlob.theme);
    if (uiBlob.customCSS != null) setIfAbsent('ecto.device.custom-css', uiBlob.customCSS);
  }

  // ── Migrate User Tier ─────────────────────────────
  const uid = userId ?? '__legacy';

  migrateKey('ecto-muted-servers', `ecto.user.${uid}.muted-servers`);
  migrateKey('ecto-muted-channels', `ecto.user.${uid}.muted-channels`);
  migrateKey('ecto-nsfw-dismissed', `ecto.user.${uid}.nsfw-dismissed`);
  migrateKey('ecto-notification-settings', `ecto.user.${uid}.notification-settings`);
  migrateKey('ecto-privacy-settings', `ecto.user.${uid}.privacy-settings`);

  // Migrate ecto-ui activeServerId to user tier
  if (uiBlob && typeof uiBlob === 'object' && uiBlob.activeServerId) {
    setIfAbsent(`ecto.user.${uid}.last-active-server`, uiBlob.activeServerId as string);
  }

  // Migrate volume keys (pattern: ecto-volume:{source}:{targetUserId})
  const volumeKeysToMigrate: Array<[string, string, string]> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('ecto-volume:')) {
      const parts = key.split(':');
      if (parts.length === 3) {
        const value = localStorage.getItem(key);
        if (value != null) {
          volumeKeysToMigrate.push([key, `ecto.user.${uid}.volume.${parts[1]}.${parts[2]}`, value]);
        }
      }
    }
  }
  for (const [, newKey, value] of volumeKeysToMigrate) {
    localStorage.setItem(newKey, value);
  }

  // ── Cleanup old keys ──────────────────────────────
  const oldKeys = [
    'ecto-ui', 'ecto-ptt-enabled', 'ecto-ptt-key', 'ecto-bypass-nsfw',
    'ecto-snapped-width', 'ecto-audio-device', 'ecto-audio-output', 'ecto-video-device',
    'ecto-video-quality', 'ecto-screen-quality', 'ecto-notification-dismissed',
    'ecto-muted-servers', 'ecto-muted-channels', 'ecto-nsfw-dismissed',
    'ecto-notification-settings', 'ecto-privacy-settings',
  ];
  for (const k of oldKeys) {
    localStorage.removeItem(k);
  }

  // Remove old volume keys
  const volumeKeysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('ecto-volume:')) volumeKeysToRemove.push(key);
  }
  for (const k of volumeKeysToRemove) {
    localStorage.removeItem(k);
  }

  localStorage.setItem('ecto.migrated', '1');
}

export function reclaimLegacyData(actualUserId: string): void {
  const prefix = 'ecto.user.__legacy.';
  const keysToMigrate: Array<[string, string]> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      const suffix = key.slice(prefix.length);
      keysToMigrate.push([key, `ecto.user.${actualUserId}.${suffix}`]);
    }
  }
  for (const [oldKey, newKey] of keysToMigrate) {
    const value = localStorage.getItem(oldKey);
    if (value != null) localStorage.setItem(newKey, value);
    localStorage.removeItem(oldKey);
  }
}

export function hasLegacyData(): boolean {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('ecto.user.__legacy.')) return true;
  }
  return false;
}
