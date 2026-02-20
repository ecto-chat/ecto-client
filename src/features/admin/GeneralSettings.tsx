import { useState, useEffect, useRef, type FormEvent } from 'react';

import { Button, Input, TextArea, Spinner, Switch, Select, Separator, ImageCropModal } from '@/ui';

import { cn } from '@/lib/cn';

import { connectionManager } from '@/services/connection-manager';

import { UPLOAD_SIZE_OPTIONS, SHARED_STORAGE_OPTIONS } from './SetupWizard/wizard-types';

import type { Server } from 'ecto-shared';

const uploadSizeSelectOptions = UPLOAD_SIZE_OPTIONS.map((opt) => ({
  value: String(opt.value),
  label: opt.label,
}));

const sharedStorageSelectOptions = SHARED_STORAGE_OPTIONS.map((opt) => ({
  value: String(opt.value),
  label: opt.label,
}));

type ServerConfig = {
  max_upload_size_bytes: number;
  max_shared_storage_bytes: number;
  allow_local_accounts: boolean;
  require_invite: boolean;
  allow_member_dms: boolean;
  show_system_messages: boolean;
};

type GeneralSettingsProps = {
  serverId: string;
};

export function GeneralSettings({ serverId }: GeneralSettingsProps) {
  const [server, setServer] = useState<Server | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [iconCropSrc, setIconCropSrc] = useState<string | null>(null);
  const [bannerCropSrc, setBannerCropSrc] = useState<string | null>(null);
  const [configError, setConfigError] = useState('');
  const [configSuccess, setConfigSuccess] = useState('');

  useEffect(() => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    trpc.server.info.query().then((result) => {
      setServer(result.server);
      setName(result.server.name);
      setDescription(result.server.description ?? '');
    }).catch((err: unknown) => {
      console.warn('[admin] Failed to load server info:', err);
    });
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

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) throw new Error('Not connected');
      const updated = await trpc.server.update.mutate({
        name: name || undefined,
        description: description || undefined,
      });
      setServer(updated);
      setSuccess('Server settings saved.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleIconUpload = async (file: File) => {
    setError('');
    try {
      const conn = connectionManager.getServerConnection(serverId);
      if (!conn) throw new Error('Not connected');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${conn.address}/upload/icon`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${conn.token}` },
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error((data as { error?: string }).error ?? 'Upload failed');
      }
      const data = (await res.json()) as { icon_url: string };
      const trpc = connectionManager.getServerTrpc(serverId);
      if (trpc) {
        await trpc.server.uploadIcon.mutate({ icon_url: data.icon_url });
      }
      setServer((prev) => prev ? { ...prev, icon_url: data.icon_url } : prev);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload icon');
    }
  };

  const handleBannerUpload = async (file: File) => {
    setError('');
    try {
      const conn = connectionManager.getServerConnection(serverId);
      if (!conn) throw new Error('Not connected');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${conn.address}/upload/banner`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${conn.token}` },
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Upload failed');
      }
      const data = (await res.json()) as { banner_url: string };
      setServer((prev) => (prev ? { ...prev, banner_url: data.banner_url } : prev));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload banner');
    }
  };

  const handleRemoveBanner = async () => {
    setError('');
    try {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) throw new Error('Not connected');
      const updated = await trpc.server.update.mutate({ banner_url: null });
      setServer(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove banner');
    }
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    setConfigError('');
    setConfigSuccess('');
    setSavingConfig(true);
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
      setConfigSuccess('Server configuration saved.');
    } catch (err: unknown) {
      setConfigError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingConfig(false);
    }
  };

  if (!server) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSave} className="space-y-5">
        <h3 className="text-base font-medium text-primary">Server Overview</h3>

        {error && <p className="text-sm text-danger">{error}</p>}
        {success && <p className="text-sm text-success">{success}</p>}

        <div className="flex gap-6">
          <div className="flex flex-col items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className={cn(
                'size-20 rounded-full bg-tertiary bg-cover bg-center flex items-center justify-center',
                'text-2xl text-secondary hover:opacity-80 p-0',
              )}
              style={server.icon_url ? { backgroundImage: `url(${server.icon_url})` } : undefined}
              onClick={() => fileInputRef.current?.click()}
            >
              {!server.icon_url && server.name.charAt(0).toUpperCase()}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (e.target) e.target.value = '';
                if (!file) return;
                if (file.type === 'image/gif') {
                  handleIconUpload(file);
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => setIconCropSrc(reader.result as string);
                reader.readAsDataURL(file);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Change Icon
            </Button>
          </div>

          <div className="flex-1 space-y-3">
            <Input
              label="Server Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <TextArea
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell people about your server..."
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-secondary">Server Banner</label>
          <div
            className="relative w-full overflow-hidden rounded-lg border border-border"
            style={{ aspectRatio: '5 / 1' }}
          >
            {server.banner_url ? (
              <img src={server.banner_url} alt="Server banner" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-tertiary" />
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => bannerInputRef.current?.click()}>
              {server.banner_url ? 'Change Banner' : 'Upload Banner'}
            </Button>
            {server.banner_url && (
              <Button type="button" variant="ghost" size="sm" onClick={handleRemoveBanner}>
                Remove Banner
              </Button>
            )}
          </div>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (e.target) e.target.value = '';
              if (!file) return;
              if (file.type === 'image/gif') {
                handleBannerUpload(file);
                return;
              }
              const reader = new FileReader();
              reader.onload = () => setBannerCropSrc(reader.result as string);
              reader.readAsDataURL(file);
            }}
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            Save
          </Button>
        </div>
      </form>

      <Separator />

      <div className="space-y-5">
        <h3 className="text-base font-medium text-primary">Server Configuration</h3>

        {configError && <p className="text-sm text-danger">{configError}</p>}
        {configSuccess && <p className="text-sm text-success">{configSuccess}</p>}

        {config ? (
          <div className="flex flex-col gap-4">
            <Switch
              label="Require Invite to Join"
              description="New members must have a valid invite code to join this server."
              checked={config.require_invite}
              onCheckedChange={(checked) => setConfig({ ...config, require_invite: checked })}
            />

            <Switch
              label="Allow Local Accounts"
              description="Allow users to create accounts directly on this server without a central Ecto account."
              checked={config.allow_local_accounts}
              onCheckedChange={(checked) => setConfig({ ...config, allow_local_accounts: checked })}
            />

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
              <Button onClick={handleSaveConfig} loading={savingConfig}>
                Save Configuration
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-4">
            <Spinner />
          </div>
        )}
      </div>
      {iconCropSrc && (
        <ImageCropModal
          open
          imageSrc={iconCropSrc}
          aspect={1}
          cropShape="round"
          title="Crop Server Icon"
          onConfirm={(blob) => {
            const file = new File([blob], 'icon.jpg', { type: 'image/jpeg' });
            handleIconUpload(file);
            setIconCropSrc(null);
          }}
          onCancel={() => setIconCropSrc(null)}
        />
      )}

      {bannerCropSrc && (
        <ImageCropModal
          open
          imageSrc={bannerCropSrc}
          aspect={5}
          title="Crop Server Banner"
          onConfirm={(blob) => {
            const file = new File([blob], 'banner.jpg', { type: 'image/jpeg' });
            handleBannerUpload(file);
            setBannerCropSrc(null);
          }}
          onCancel={() => setBannerCropSrc(null)}
        />
      )}
    </div>
  );
}
