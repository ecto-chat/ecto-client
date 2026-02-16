import { useState, useEffect, useCallback } from 'react';
import { playNotificationSound } from '../../lib/notification-sounds.js';

const STORAGE_KEY = 'ecto-notification-settings';

interface NotificationPrefs {
  enabled: boolean;
  soundEnabled: boolean;
  showDMs: boolean;
  showMentions: boolean;
  showEveryone: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  enabled: true,
  soundEnabled: true,
  showDMs: true,
  showMentions: true,
  showEveryone: false,
};

function loadPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_PREFS, ...JSON.parse(raw) } as NotificationPrefs;
    }
  } catch {
    // Ignore parse errors
  }
  return { ...DEFAULT_PREFS };
}

function savePrefs(prefs: NotificationPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleRow({ label, description, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <label className={`notification-toggle-row ${disabled ? 'notification-toggle-disabled' : ''}`}>
      <div className="notification-toggle-info">
        <span className="notification-toggle-label">{label}</span>
        <span className="notification-toggle-desc">{description}</span>
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="notification-toggle-checkbox"
      />
    </label>
  );
}

export function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(loadPrefs);

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  const update = useCallback((key: keyof NotificationPrefs, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const allDisabled = !prefs.enabled;

  return (
    <div className="settings-section">
      <h2 className="settings-heading">Notifications</h2>

      <div className="notification-toggles">
        <ToggleRow
          label="Enable Notifications"
          description="Master toggle for all desktop and in-app notifications"
          checked={prefs.enabled}
          onChange={(v) => update('enabled', v)}
        />

        <ToggleRow
          label="Notification Sounds"
          description="Play a sound when receiving notifications"
          checked={prefs.soundEnabled}
          disabled={allDisabled}
          onChange={(v) => update('soundEnabled', v)}
        />

        {prefs.soundEnabled && !allDisabled && (
          <div className="notification-sound-preview" style={{ padding: '8px 0 4px 16px', display: 'flex', gap: 8 }}>
            <button className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => playNotificationSound('message')}>
              Preview Message
            </button>
            <button className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => playNotificationSound('mention')}>
              Preview Mention
            </button>
            <button className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => playNotificationSound('dm')}>
              Preview DM
            </button>
          </div>
        )}

        <ToggleRow
          label="Direct Messages"
          description="Show notifications for new direct messages"
          checked={prefs.showDMs}
          disabled={allDisabled}
          onChange={(v) => update('showDMs', v)}
        />

        <ToggleRow
          label="Mentions"
          description="Show notifications when you are mentioned"
          checked={prefs.showMentions}
          disabled={allDisabled}
          onChange={(v) => update('showMentions', v)}
        />

        <ToggleRow
          label="@everyone / @here"
          description="Show notifications for @everyone and @here mentions"
          checked={prefs.showEveryone}
          disabled={allDisabled}
          onChange={(v) => update('showEveryone', v)}
        />
      </div>

      {allDisabled && (
        <p className="settings-hint notification-muted-hint">
          All notifications are currently disabled. Enable the master toggle to configure individual settings.
        </p>
      )}
    </div>
  );
}
