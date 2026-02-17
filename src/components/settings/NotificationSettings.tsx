import { useState, useEffect, useCallback } from 'react';
import { playNotificationSound, playSoundVariant, SOUND_LIBRARY } from '../../lib/notification-sounds.js';
import type { SoundType } from '../../lib/notification-sounds.js';

const STORAGE_KEY = 'ecto-notification-settings';

interface NotificationPrefs {
  enabled: boolean;
  soundEnabled: boolean;
  showDMs: boolean;
  showMentions: boolean;
  showEveryone: boolean;
  selectedSounds: { message: string; mention: string; dm: string };
}

const DEFAULT_PREFS: NotificationPrefs = {
  enabled: true,
  soundEnabled: true,
  showDMs: true,
  showMentions: true,
  showEveryone: false,
  selectedSounds: { message: 'default', mention: 'default', dm: 'default' },
};

function loadPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
      return {
        ...DEFAULT_PREFS,
        ...parsed,
        selectedSounds: { ...DEFAULT_PREFS.selectedSounds, ...parsed.selectedSounds },
      };
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

const SOUND_EVENT_TYPES: { type: SoundType; label: string }[] = [
  { type: 'message', label: 'Message' },
  { type: 'mention', label: 'Mention' },
  { type: 'dm', label: 'DM' },
];

export function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(loadPrefs);

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  const update = useCallback((key: keyof NotificationPrefs, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateSound = useCallback((type: SoundType, soundId: string) => {
    setPrefs((prev) => ({
      ...prev,
      selectedSounds: { ...prev.selectedSounds, [type]: soundId },
    }));
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
          <div style={{ padding: '8px 0 4px 16px' }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary, #b9bbbe)', marginBottom: 8, fontWeight: 500 }}>
              Sound Selection
            </div>
            {SOUND_EVENT_TYPES.map(({ type, label }) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary, #b9bbbe)', minWidth: 60 }}>{label}</span>
                <select
                  className="auth-input"
                  style={{ fontSize: 12, padding: '3px 8px', minWidth: 100 }}
                  value={prefs.selectedSounds[type]}
                  onChange={(e) => updateSound(type, e.target.value)}
                >
                  {SOUND_LIBRARY.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <button
                  className="btn-secondary"
                  style={{ fontSize: 11, padding: '3px 8px' }}
                  onClick={() => playSoundVariant(prefs.selectedSounds[type], type)}
                  title={`Preview ${label} sound`}
                >
                  &#9654;
                </button>
              </div>
            ))}
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
