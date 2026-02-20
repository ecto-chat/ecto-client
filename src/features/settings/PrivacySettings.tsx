import { useState, useEffect, useCallback } from 'react';

import { Switch } from '@/ui';

import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { useServerStore } from '@/stores/server';
import { useMemberStore } from '@/stores/member';

import { connectionManager } from '@/services/connection-manager';
import { preferenceManager } from '@/services/preference-manager';

type PrivacyPrefs = {
  allowDmsFromStrangers: boolean;
};

function loadPrefs(): PrivacyPrefs {
  return preferenceManager.getUser<PrivacyPrefs>('privacy-settings', { allowDmsFromStrangers: true });
}

export function PrivacySettings() {
  const user = useAuthStore((s) => s.user);
  const bypassNsfw = useUiStore((s) => s.bypassNsfwWarnings);
  const activeServerId = useUiStore((s) => s.activeServerId);
  const allowMemberDms = useServerStore((s) =>
    activeServerId ? s.serverMeta.get(activeServerId)?.allow_member_dms ?? false : false,
  );
  const currentMember = useMemberStore((s) =>
    activeServerId && user ? s.members.get(activeServerId)?.get(user.id) : undefined,
  );
  const [prefs, setPrefs] = useState<PrivacyPrefs>(loadPrefs);
  const [saving, setSaving] = useState(false);
  const [serverDmSaving, setServerDmSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    preferenceManager.setUser('privacy-settings', prefs);
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

      {allowMemberDms && activeServerId && currentMember && (
        <>
          <h3 className="text-sm font-medium text-secondary pt-2">Server Private Messages</h3>
          <Switch
            label="Allow members to send you private messages"
            description="When disabled, other members on this server cannot initiate private messages with you."
            checked={currentMember.allow_dms}
            disabled={serverDmSaving}
            onCheckedChange={async (checked) => {
              setError('');
              setSuccess('');
              setServerDmSaving(true);
              try {
                const trpc = connectionManager.getServerTrpc(activeServerId);
                if (!trpc) throw new Error('Not connected to server');
                await trpc.members.updateDmPreference.mutate({ allow_dms: checked });
                useMemberStore.getState().updateMember(activeServerId, currentMember.user_id, { allow_dms: checked });
                setSuccess('Server DM preference updated.');
              } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Failed to update');
              } finally {
                setServerDmSaving(false);
              }
            }}
          />
        </>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-secondary">About Privacy</h3>
        <p className="text-xs text-muted">
          Friends can always send you direct messages. Blocked users cannot contact you or see your messages in shared servers.
        </p>
      </div>
    </div>
  );
}
