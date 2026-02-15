import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/auth.js';
import { connectionManager } from '../../services/connection-manager.js';

const STORAGE_KEY = 'ecto-privacy-settings';

interface PrivacyPrefs {
  allowDmsFromStrangers: boolean;
}

function loadPrefs(): PrivacyPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PrivacyPrefs;
  } catch {
    // Ignore
  }
  return { allowDmsFromStrangers: true };
}

export function PrivacySettings() {
  const user = useAuthStore((s) => s.user);
  const [prefs, setPrefs] = useState<PrivacyPrefs>(loadPrefs);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const handleToggleDmsFromStrangers = useCallback(async (checked: boolean) => {
    setPrefs((prev) => ({ ...prev, allowDmsFromStrangers: checked }));
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const trpc = connectionManager.getCentralTrpc();
      if (!trpc) throw new Error('Not connected to central');

      await trpc.profile.update.mutate({
        allow_dms_from_strangers: checked,
      });
      setSuccess('Privacy settings updated.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update');
      setPrefs((prev) => ({ ...prev, allowDmsFromStrangers: !checked }));
    } finally {
      setSaving(false);
    }
  }, []);

  if (!user) return null;

  return (
    <div className="settings-section">
      <h2 className="settings-heading">Privacy</h2>

      {error && <div className="settings-error">{error}</div>}
      {success && <div className="settings-success">{success}</div>}

      <div className="privacy-toggles">
        <label className="notification-toggle-row">
          <div className="notification-toggle-info">
            <span className="notification-toggle-label">Allow DMs from non-friends</span>
            <span className="notification-toggle-desc">
              When enabled, anyone with a global account can send you direct messages — not just friends.
            </span>
          </div>
          <input
            type="checkbox"
            checked={prefs.allowDmsFromStrangers}
            disabled={saving}
            onChange={(e) => handleToggleDmsFromStrangers(e.target.checked)}
            className="notification-toggle-checkbox"
          />
        </label>
      </div>

      <div className="settings-group" style={{ marginTop: 24 }}>
        <h3 className="settings-subheading">About Privacy</h3>
        <p className="settings-hint">
          Friends can always send you direct messages. Blocked users cannot contact you or see your messages in shared servers.
        </p>
      </div>
    </div>
  );
}
