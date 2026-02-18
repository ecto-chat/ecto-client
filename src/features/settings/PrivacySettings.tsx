import { useState, useEffect, useCallback } from 'react';

import { Switch } from '@/ui';

import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

import { connectionManager } from '@/services/connection-manager';

const STORAGE_KEY = 'ecto-privacy-settings';

type PrivacyPrefs = {
  allowDmsFromStrangers: boolean;
};

function loadPrefs(): PrivacyPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PrivacyPrefs;
  } catch { /* ignore */ }
  return { allowDmsFromStrangers: true };
}

export function PrivacySettings() {
  const user = useAuthStore((s) => s.user);
  const bypassNsfw = useUiStore((s) => s.bypassNsfwWarnings);
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
      await trpc.profile.update.mutate({ allow_dms_from_strangers: checked });
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
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-primary">Privacy</h2>

      {error && <p className="text-sm text-danger">{error}</p>}
      {success && <p className="text-sm text-success">{success}</p>}

      <Switch
        label="Allow DMs from non-friends"
        description="When enabled, anyone with a global account can send you direct messages — not just friends."
        checked={prefs.allowDmsFromStrangers}
        disabled={saving}
        onCheckedChange={handleToggleDmsFromStrangers}
      />

      <Switch
        label="Bypass NSFW warnings"
        description="Skip age-restriction warnings when entering NSFW channels."
        checked={bypassNsfw}
        onCheckedChange={(checked) => useUiStore.getState().setBypassNsfwWarnings(checked)}
      />

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-secondary">About Privacy</h3>
        <p className="text-xs text-muted">
          Friends can always send you direct messages. Blocked users cannot contact you or see your messages in shared servers.
        </p>
      </div>
    </div>
  );
}
