import { useState, useEffect } from 'react';

import { Button, Spinner, Switch, Select } from '@/ui';

import { connectionManager } from '@/services/connection-manager';
import { useServerStore } from '@/stores/server';

import { UPLOAD_SIZE_OPTIONS, SHARED_STORAGE_OPTIONS } from './SetupWizard/wizard-types';

const uploadSizeSelectOptions = UPLOAD_SIZE_OPTIONS.map((opt) => ({
  value: String(opt.value),
  label: opt.label,
}));

const sharedStorageSelectOptions = SHARED_STORAGE_OPTIONS.map((opt) => ({
  value: String(opt.value),
  label: opt.label,
}));

type ConfigState = {
  max_upload_size_bytes: number;
  max_shared_storage_bytes: number;
  allow_local_accounts: boolean;
  require_invite: boolean;
  allow_member_dms: boolean;
  show_system_messages: boolean;
};

type ConfigurationSettingsProps = {
  serverId: string;
};

export function ConfigurationSettings({ serverId }: ConfigurationSettingsProps) {
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const isManaged = useServerStore((s) => s.serverMeta.get(serverId)?.hosting_mode === 'managed');

  useEffect(() => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    trpc.serverConfig.get.query().then((cfg) => {
      setConfig({
        max_upload_size_bytes: cfg.max_upload_size_bytes,
        max_shared_storage_bytes: cfg.max_shared_storage_bytes,
        allow_local_accounts: cfg.allow_local_accounts,
        require_invite: cfg.require_invite,
        allow_member_dms: cfg.allow_member_dms,
        show_system_messages: cfg.show_system_messages,
      });
    }).catch((err: unknown) => {
      console.warn('[admin] Failed to load server config:', err);
    });
  }, [serverId]);

  const handleSave = async () => {
    if (!config) return;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) throw new Error('Not connected');
      await trpc.serverConfig.update.mutate({
        max_upload_size_bytes: config.max_upload_size_bytes,
        max_shared_storage_bytes: config.max_shared_storage_bytes,
        allow_local_accounts: config.allow_local_accounts,
        require_invite: config.require_invite,
        allow_member_dms: config.allow_member_dms,
        show_system_messages: config.show_system_messages,
      });
      setSuccess('Configuration saved.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h3 className="text-base font-medium text-primary">Configuration</h3>

      {error && <p className="text-sm text-danger">{error}</p>}
      {success && <p className="text-sm text-success">{success}</p>}

      <div className="flex flex-col gap-4">
        <Switch
          label="Require Invite to Join"
          description="New members must have a valid invite code to join this server."
          checked={config.require_invite}
          onCheckedChange={(checked) => setConfig({ ...config, require_invite: checked })}
        />

        {!isManaged && (
          <Switch
            label="Allow Local Accounts"
            description="Allow users to create accounts directly on this server without a central Ecto account."
            checked={config.allow_local_accounts}
            onCheckedChange={(checked) => setConfig({ ...config, allow_local_accounts: checked })}
          />
        )}

        <Switch
          label="Allow Member DMs"
          description="Allow members to send direct messages to each other within this server."
          checked={config.allow_member_dms}
          onCheckedChange={(checked) => setConfig({ ...config, allow_member_dms: checked })}
        />

        <Switch
          label="Show System Messages"
          description="Display notifications in chat when members join or messages are pinned."
          checked={config.show_system_messages}
          onCheckedChange={(checked) => setConfig({ ...config, show_system_messages: checked })}
        />

        <Select
          label="Max File Size"
          options={uploadSizeSelectOptions}
          value={String(config.max_upload_size_bytes)}
          onValueChange={(value) => setConfig({ ...config, max_upload_size_bytes: Number(value) })}
        />

        <Select
          label="Shared Storage Capacity"
          options={sharedStorageSelectOptions}
          value={String(config.max_shared_storage_bytes)}
          onValueChange={(value) => setConfig({ ...config, max_shared_storage_bytes: Number(value) })}
        />

        <div className="flex justify-end">
          <Button onClick={handleSave} loading={saving}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
