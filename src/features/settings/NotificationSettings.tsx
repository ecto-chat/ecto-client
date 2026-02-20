import { useState, useEffect, useCallback } from 'react';

import { Play } from 'lucide-react';

import { Switch, Select, Button, IconButton } from '@/ui';

import { requestNotificationPermission } from '@/services/notification-service';
import { preferenceManager } from '@/services/preference-manager';

import { playSoundVariant, SOUND_LIBRARY } from '@/lib/notification-sounds';
import type { SoundType } from '@/lib/notification-sounds';

type NotificationPrefs = {
  enabled: boolean;
  soundEnabled: boolean;
  showDMs: boolean;
  showMentions: boolean;
  showEveryone: boolean;
  selectedSounds: { message: string; mention: string; dm: string };
};

const DEFAULT_PREFS: NotificationPrefs = {
  enabled: true,
  soundEnabled: true,
  showDMs: true,
  showMentions: true,
  showEveryone: false,
  selectedSounds: { message: 'default', mention: 'default', dm: 'default' },
};

function loadPrefs(): NotificationPrefs {
  const stored = preferenceManager.getUser<Partial<NotificationPrefs>>('notification-settings', {});
  return { ...DEFAULT_PREFS, ...stored, selectedSounds: { ...DEFAULT_PREFS.selectedSounds, ...stored.selectedSounds } };
}

const SOUND_EVENT_TYPES: { type: SoundType; label: string }[] = [
  { type: 'message', label: 'Message' },
  { type: 'mention', label: 'Mention' },
  { type: 'dm', label: 'DM' },
];

const soundOptions = SOUND_LIBRARY.map((s) => ({ value: s.id, label: s.name }));

export function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(loadPrefs);
  const [webPermission, setWebPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (window.electronAPI) return 'granted';
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  useEffect(() => { preferenceManager.setUser('notification-settings', prefs); }, [prefs]);

  const update = useCallback((key: keyof NotificationPrefs, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateSound = useCallback((type: SoundType, soundId: string) => {
    setPrefs((prev) => ({ ...prev, selectedSounds: { ...prev.selectedSounds, [type]: soundId } }));
  }, []);

  const allDisabled = !prefs.enabled;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-primary">Notifications</h2>

      <div className="space-y-3">
        <Switch label="Enable Notifications" description="Master toggle for all desktop and in-app notifications" checked={prefs.enabled} onCheckedChange={(v) => update('enabled', v)} />

        {!window.electronAPI && webPermission !== 'granted' && webPermission !== 'unsupported' && (
          <div className="flex items-center gap-3 py-1">
            <Button size="sm" onClick={async () => { const granted = await requestNotificationPermission(); setWebPermission(granted ? 'granted' : 'denied'); }}>
              Enable OS Notifications
            </Button>
            <span className="text-xs text-muted">
              {webPermission === 'denied' ? 'Permission denied — enable in browser settings' : 'Allow browser notifications to receive alerts when this tab is not focused'}
            </span>
          </div>
        )}

        <Switch label="Notification Sounds" description="Play a sound when receiving notifications" checked={prefs.soundEnabled} disabled={allDisabled} onCheckedChange={(v) => update('soundEnabled', v)} />

        {prefs.soundEnabled && !allDisabled && (
          <div className="space-y-2 pl-4">
            <span className="text-xs uppercase tracking-wider font-semibold text-muted">Sound Selection</span>
            {SOUND_EVENT_TYPES.map(({ type, label }) => (
              <div key={type} className="flex items-center gap-2">
                <span className="text-xs text-muted w-16">{label}</span>
                <Select options={soundOptions} value={prefs.selectedSounds[type]} onValueChange={(v) => updateSound(type, v)} className="min-w-[120px]" />
                <IconButton size="sm" variant="ghost" tooltip={`Preview ${label} sound`} onClick={() => playSoundVariant(prefs.selectedSounds[type], type)}>
                  <Play size={14} />
                </IconButton>
              </div>
            ))}
          </div>
        )}

        <Switch label="Direct Messages" description="Show notifications for new direct messages" checked={prefs.showDMs} disabled={allDisabled} onCheckedChange={(v) => update('showDMs', v)} />
        <Switch label="Mentions" description="Show notifications when you are mentioned" checked={prefs.showMentions} disabled={allDisabled} onCheckedChange={(v) => update('showMentions', v)} />
        <Switch label="@everyone / @here" description="Show notifications for @everyone and @here mentions" checked={prefs.showEveryone} disabled={allDisabled} onCheckedChange={(v) => update('showEveryone', v)} />
      </div>

      {allDisabled && (
        <p className="text-xs text-muted">All notifications are currently disabled. Enable the master toggle to configure individual settings.</p>
      )}
    </div>
  );
}
