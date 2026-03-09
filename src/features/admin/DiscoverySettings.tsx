import { useState, useEffect } from 'react';

import { Button, Spinner, Switch, TagInput } from '@/ui';

import { connectionManager } from 'ecto-core';

type DiscoveryState = {
  discoverable: boolean;
  tags: string[];
};

type DiscoverySettingsProps = {
  serverId: string;
};

export function DiscoverySettings({ serverId }: DiscoverySettingsProps) {
  const [config, setConfig] = useState<DiscoveryState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    trpc.serverConfig.get.query().then((cfg) => {
      setConfig({
        discoverable: cfg.discoverable ?? false,
        tags: cfg.tags ?? [],
      });
    }).catch((err: unknown) => {
      console.warn('[admin] Failed to load discovery config:', err);
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
        discoverable: config.discoverable,
        tags: config.tags,
      });
      setSuccess('Discovery settings saved.');
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
      <h3 className="text-base font-medium text-primary">Discovery</h3>

      {error && <p className="text-sm text-danger">{error}</p>}
      {success && <p className="text-sm text-success">{success}</p>}

      <div className="flex flex-col gap-4">
        <Switch
          label="Server Discovery"
          description="Allow this server to appear in the Ecto Discover feed."
          checked={config.discoverable}
          onCheckedChange={(checked) => setConfig({ ...config, discoverable: checked })}
        />

        <p className="text-sm text-muted">
          Discoverable servers are reviewed and approved by Ecto admins before appearing in the public feed.
          Add tags below to help users find your server by topic.
        </p>

        <TagInput
          label="Server Tags"
          tags={config.tags}
          onChange={(tags) => setConfig({ ...config, tags })}
          placeholder="gaming, community, art..."
          disabled={!config.discoverable}
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
