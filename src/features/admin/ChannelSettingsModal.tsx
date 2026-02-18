import { useState, useEffect, useCallback } from 'react';
import type { ChannelPermissionOverride, CategoryPermissionOverride } from 'ecto-shared';
import { Permissions } from 'ecto-shared';
import { X, Check, Minus, AlertTriangle } from 'lucide-react';

import { Modal, Tabs, TabsList, TabsTrigger, TabsContent, Input, Select, Switch, Button, ScrollArea } from '@/ui';

import { useUiStore } from '@/stores/ui';
import { useChannelStore } from '@/stores/channel';
import { useRoleStore } from '@/stores/role';
import { connectionManager } from '@/services/connection-manager';

const SLOWMODE_OPTIONS = [
  { value: '0', label: 'Off' },
  { value: '1', label: '1s' },
  { value: '5', label: '5s' },
  { value: '10', label: '10s' },
  { value: '30', label: '30s' },
  { value: '60', label: '1m' },
  { value: '120', label: '2m' },
  { value: '300', label: '5m' },
  { value: '600', label: '10m' },
  { value: '1800', label: '30m' },
  { value: '3600', label: '1h' },
];

// Channel-level permissions grouped by category (matching Discord screenshots)
type PermDef = { key: keyof typeof Permissions; label: string; description: string };

const GENERAL_PERMS: PermDef[] = [
  { key: 'READ_MESSAGES', label: 'View Channel', description: 'Allows members to view this channel.' },
  { key: 'MANAGE_CHANNELS', label: 'Manage Channel', description: "Allows members to change this channel's name, description, and settings." },
  { key: 'MANAGE_MESSAGES', label: 'Manage Messages', description: 'Allows members to delete or pin messages by other members.' },
  { key: 'MANAGE_WEBHOOKS', label: 'Manage Webhooks', description: 'Allows members to create, edit, or delete webhooks in this channel.' },
];

const MEMBERSHIP_PERMS: PermDef[] = [
  { key: 'CREATE_INVITES', label: 'Create Invites', description: 'Allows members to invite new people to this server via a direct link to this channel.' },
];

const TEXT_PERMS: PermDef[] = [
  { key: 'SEND_MESSAGES', label: 'Send Messages', description: 'Allows members to send messages in this channel.' },
  { key: 'ATTACH_FILES', label: 'Attach Files', description: 'Allows members to upload files or media in this channel.' },
  { key: 'EMBED_LINKS', label: 'Embed Links', description: 'Allows links that members share to show embedded content in this channel.' },
  { key: 'ADD_REACTIONS', label: 'Add Reactions', description: 'Allows members to add emoji reactions to messages in this channel.' },
  { key: 'EDIT_PAGES', label: 'Edit Pages', description: 'Allows members to edit page channel content.' },
];

const VOICE_PERMS: PermDef[] = [
  { key: 'CONNECT_VOICE', label: 'Connect', description: 'Allows members to join this voice channel.' },
  { key: 'SPEAK_VOICE', label: 'Speak', description: 'Allows members to speak in this voice channel.' },
  { key: 'USE_VIDEO', label: 'Use Video', description: 'Allows members to turn on their camera in this voice channel.' },
  { key: 'SCREEN_SHARE', label: 'Screen Share', description: 'Allows members to share their screen in this voice channel.' },
  { key: 'USE_VOICE_ACTIVITY', label: 'Use Voice Activity', description: 'Allows members to speak without using push-to-talk.' },
  { key: 'MUTE_MEMBERS', label: 'Mute Members', description: 'Allows members to mute other members in this voice channel.' },
  { key: 'DEAFEN_MEMBERS', label: 'Deafen Members', description: 'Allows members to deafen other members in this voice channel.' },
];

type PermCategory = { label: string; perms: PermDef[] };

function getPermCategories(channelType: string): PermCategory[] {
  const categories: PermCategory[] = [];
  if (channelType === 'text' || channelType === 'page') {
    categories.push({ label: 'Text Channel Permissions', perms: TEXT_PERMS });
  }
  if (channelType === 'voice') {
    categories.push({ label: 'Voice Channel Permissions', perms: VOICE_PERMS });
  }
  categories.push(
    { label: 'General Channel Permissions', perms: GENERAL_PERMS },
    { label: 'Membership Permissions', perms: MEMBERSHIP_PERMS },
  );
  return categories;
}

type TriState = 'allow' | 'deny' | 'inherit';

function TriStateToggle({ value, onChange }: { value: TriState; onChange: (v: TriState) => void }) {
  return (
    <div className="flex gap-0.5">
      <button
        onClick={() => onChange('deny')}
        className={`w-8 h-8 flex items-center justify-center rounded-l-md transition-colors ${
          value === 'deny' ? 'bg-danger/20 text-danger' : 'bg-tertiary text-muted hover:bg-hover'
        }`}
        title="Deny"
      >
        <X size={14} />
      </button>
      <button
        onClick={() => onChange('inherit')}
        className={`w-8 h-8 flex items-center justify-center transition-colors ${
          value === 'inherit' ? 'bg-hover text-primary' : 'bg-tertiary text-muted hover:bg-hover'
        }`}
        title="Inherit"
      >
        <Minus size={14} />
      </button>
      <button
        onClick={() => onChange('allow')}
        className={`w-8 h-8 flex items-center justify-center rounded-r-md transition-colors ${
          value === 'allow' ? 'bg-success/20 text-success' : 'bg-tertiary text-muted hover:bg-hover'
        }`}
        title="Allow"
      >
        <Check size={14} />
      </button>
    </div>
  );
}

type OverrideState = { allow: number; deny: number };

// ── Permissions panel (shared between channel & category) ──

function PermissionsPanel({
  overrides,
  setOverrides,
  overridesLoaded,
  selectedRoleId,
  setSelectedRoleId,
  rolesMap,
  permCategories,
  saving,
  onSave,
  error,
  syncWarning,
}: {
  overrides: Map<string, OverrideState>;
  setOverrides: React.Dispatch<React.SetStateAction<Map<string, OverrideState>>>;
  overridesLoaded: boolean;
  selectedRoleId: string | null;
  setSelectedRoleId: (id: string | null) => void;
  rolesMap: Map<string, import('ecto-shared').Role> | undefined;
  permCategories: PermCategory[];
  saving: boolean;
  onSave: () => void;
  error: string;
  syncWarning?: string | null;
}) {
  const roles = rolesMap ? [...rolesMap.values()].sort((a, b) => b.position - a.position) : [];
  const roleOptions = roles.map((r) => ({ value: r.id, label: r.name }));

  const getPermState = (roleId: string, permBit: number): TriState => {
    const o = overrides.get(roleId);
    if (!o) return 'inherit';
    if (o.allow & permBit) return 'allow';
    if (o.deny & permBit) return 'deny';
    return 'inherit';
  };

  const setPermState = (roleId: string, permBit: number, state: TriState) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      const existing = next.get(roleId) ?? { allow: 0, deny: 0 };
      let allow = existing.allow & ~permBit;
      let deny = existing.deny & ~permBit;
      if (state === 'allow') allow |= permBit;
      if (state === 'deny') deny |= permBit;
      if (allow === 0 && deny === 0) {
        next.delete(roleId);
      } else {
        next.set(roleId, { allow, deny });
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-danger">{error}</p>}
      {syncWarning && (
        <div className="flex items-start gap-2 rounded-md bg-warning/10 border border-warning/30 px-3 py-2">
          <AlertTriangle size={16} className="text-warning mt-0.5 shrink-0" />
          <p className="text-sm text-warning">{syncWarning}</p>
        </div>
      )}
      {!overridesLoaded ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : (
        <>
          <Select
            label="Role"
            options={roleOptions}
            value={selectedRoleId ?? undefined}
            onValueChange={setSelectedRoleId}
            placeholder="Select a role"
          />

          {selectedRoleId && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6 pr-2">
                {permCategories.map((cat) => (
                  <div key={cat.label}>
                    <h4 className="text-xs uppercase tracking-wider font-semibold text-muted mb-3">
                      {cat.label}
                    </h4>
                    <div className="space-y-1">
                      {cat.perms.map((perm) => {
                        const bit = Permissions[perm.key];
                        const state = getPermState(selectedRoleId, bit);
                        return (
                          <div
                            key={perm.key}
                            className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-primary">{perm.label}</p>
                              <p className="text-xs text-muted">{perm.description}</p>
                            </div>
                            <TriStateToggle
                              value={state}
                              onChange={(v) => setPermState(selectedRoleId, bit, v)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <div className="pt-2">
            <Button onClick={onSave} loading={saving}>
              Save Permissions
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main modal ──

export function ChannelSettingsModal() {
  const channelSettingsId = useUiStore((s) => s.channelSettingsId);
  const activeServerId = useUiStore((s) => s.activeServerId);

  // Determine if this is a category or channel
  const isCategory = channelSettingsId?.startsWith('cat:') ?? false;
  const targetId = isCategory ? channelSettingsId!.slice(4) : channelSettingsId;

  const channel = useChannelStore((s) =>
    activeServerId && targetId && !isCategory
      ? s.channels.get(activeServerId)?.get(targetId)
      : undefined,
  );
  const category = useChannelStore((s) =>
    activeServerId && targetId && isCategory
      ? s.categories.get(activeServerId)?.get(targetId)
      : undefined,
  );
  const rolesMap = useRoleStore((s) => (activeServerId ? s.roles.get(activeServerId) : undefined));

  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [slowmode, setSlowmode] = useState('0');
  const [nsfw, setNsfw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Permission overrides: roleId → override state
  const [overrides, setOverrides] = useState<Map<string, OverrideState>>(new Map());
  const [overridesLoaded, setOverridesLoaded] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  // Category overrides for sync warning (only used when editing a channel with a category)
  const [categoryOverrides, setCategoryOverrides] = useState<Map<string, OverrideState>>(new Map());

  // Reset form when target changes
  useEffect(() => {
    if (channel) {
      setName(channel.name);
      setTopic(channel.topic ?? '');
      setSlowmode(String(channel.slowmode_seconds));
      setNsfw(channel.nsfw);
    } else if (category) {
      setName(category.name);
      setTopic('');
      setSlowmode('0');
      setNsfw(false);
    }
    setError('');
    setOverridesLoaded(false);
    setSelectedRoleId(null);
    setCategoryOverrides(new Map());
  }, [targetId]);

  // Fetch overrides for both channels and categories
  useEffect(() => {
    if (!targetId || !activeServerId) {
      setOverridesLoaded(true);
      return;
    }
    const trpc = connectionManager.getServerTrpc(activeServerId);
    if (!trpc) { setOverridesLoaded(true); return; }

    if (isCategory) {
      // Fetch category overrides
      trpc.categories.getOverrides
        .query({ category_id: targetId })
        .then((result: CategoryPermissionOverride[]) => {
          const map = new Map<string, OverrideState>();
          for (const o of result) {
            if (o.target_type === 'role') {
              map.set(o.target_id, { allow: o.allow, deny: o.deny });
            }
          }
          setOverrides(map);
          setOverridesLoaded(true);
        })
        .catch(() => setOverridesLoaded(true));
    } else {
      // Fetch channel overrides
      const channelPromise = trpc.channels.getOverrides
        .query({ channel_id: targetId })
        .then((result: ChannelPermissionOverride[]) => {
          const map = new Map<string, OverrideState>();
          for (const o of result) {
            if (o.target_type === 'role') {
              map.set(o.target_id, { allow: o.allow, deny: o.deny });
            }
          }
          setOverrides(map);
        });

      // Also fetch parent category overrides for sync warning
      const categoryId = channel?.category_id;
      const catPromise = categoryId
        ? trpc.categories.getOverrides
            .query({ category_id: categoryId })
            .then((result: CategoryPermissionOverride[]) => {
              const map = new Map<string, OverrideState>();
              for (const o of result) {
                if (o.target_type === 'role') {
                  map.set(o.target_id, { allow: o.allow, deny: o.deny });
                }
              }
              setCategoryOverrides(map);
            })
            .catch(() => {})
        : Promise.resolve();

      Promise.all([channelPromise, catPromise])
        .then(() => setOverridesLoaded(true))
        .catch(() => setOverridesLoaded(true));
    }
  }, [targetId, activeServerId, isCategory, channel?.category_id]);

  // Auto-select first role when loaded
  useEffect(() => {
    if (overridesLoaded && !selectedRoleId && rolesMap) {
      const roles = [...rolesMap.values()].sort((a, b) => b.position - a.position);
      const defaultRole = roles.find((r) => r.is_default) ?? roles[0];
      if (defaultRole) setSelectedRoleId(defaultRole.id);
    }
  }, [overridesLoaded, selectedRoleId, rolesMap]);

  const handleClose = useCallback(() => {
    useUiStore.getState().setChannelSettingsId(null);
  }, []);

  // ── Channel handlers ──

  const handleSaveOverview = useCallback(async () => {
    if (!targetId || !activeServerId) return;
    const trpc = connectionManager.getServerTrpc(activeServerId);
    if (!trpc) return;

    setSaving(true);
    setError('');
    try {
      if (isCategory) {
        await trpc.categories.update.mutate({
          category_id: targetId,
          name: name.trim(),
        });
      } else {
        await trpc.channels.update.mutate({
          channel_id: targetId,
          name: name.trim() || undefined,
          topic: topic || undefined,
          slowmode_seconds: Number(slowmode),
          nsfw,
        });
      }
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [targetId, activeServerId, isCategory, name, topic, slowmode, nsfw, handleClose]);

  const handleDelete = useCallback(async () => {
    if (!targetId || !activeServerId) return;
    const trpc = connectionManager.getServerTrpc(activeServerId);
    if (!trpc) return;

    setSaving(true);
    try {
      if (isCategory) {
        await trpc.categories.delete.mutate({ category_id: targetId });
      } else {
        await trpc.channels.delete.mutate({ channel_id: targetId });
      }
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setSaving(false);
    }
  }, [targetId, activeServerId, isCategory, handleClose]);

  const handleSavePermissions = useCallback(async () => {
    if (!targetId || !activeServerId) return;
    const trpc = connectionManager.getServerTrpc(activeServerId);
    if (!trpc) return;

    setSaving(true);
    setError('');
    try {
      const permission_overrides = [...overrides.entries()].map(([roleId, o]) => ({
        target_type: 'role' as const,
        target_id: roleId,
        allow: o.allow,
        deny: o.deny,
      }));
      if (isCategory) {
        await trpc.categories.update.mutate({
          category_id: targetId,
          permission_overrides,
        });
      } else {
        await trpc.channels.update.mutate({
          channel_id: targetId,
          permission_overrides,
        });
      }
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [targetId, activeServerId, isCategory, overrides, handleClose]);

  const open = channelSettingsId !== null;
  if (!open) return null;

  const permCategories = getPermCategories(channel?.type ?? 'text');
  const modalTitle = isCategory ? 'Category Settings' : 'Channel Settings';

  // Compute sync warning for channels that belong to a category
  let syncWarning: string | null = null;
  if (!isCategory && channel?.category_id && selectedRoleId && overridesLoaded) {
    const channelOvr = overrides.get(selectedRoleId);
    const catOvr = categoryOverrides.get(selectedRoleId);
    if (channelOvr && catOvr) {
      // Check if channel overrides conflict with category overrides
      const catDeniedButChannelAllowed = catOvr.deny & channelOvr.allow;
      const catAllowedButChannelDenied = catOvr.allow & channelOvr.deny;
      if (catDeniedButChannelAllowed || catAllowedButChannelDenied) {
        syncWarning = 'This channel has permissions that differ from its category. Channel-level overrides take priority.';
      }
    } else if (channelOvr && !catOvr) {
      // Channel has overrides but category doesn't for this role — channel-specific, not a conflict
    }
  }

  // ── Category settings (full — overview + permissions) ──
  if (isCategory) {
    return (
      <Modal open={open} onOpenChange={(v) => !v && handleClose()} title={modalTitle} width="lg">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
          </TabsList>

          {error && <p className="text-sm text-danger mt-2">{error}</p>}

          <TabsContent value="overview">
            <div className="space-y-4">
              <Input
                label="Category Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSaveOverview} loading={saving}>
                  Save
                </Button>
                <Button variant="danger" onClick={handleDelete} loading={saving}>
                  Delete Category
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="permissions">
            <PermissionsPanel
              overrides={overrides}
              setOverrides={setOverrides}
              overridesLoaded={overridesLoaded}
              selectedRoleId={selectedRoleId}
              setSelectedRoleId={setSelectedRoleId}
              rolesMap={rolesMap}
              permCategories={permCategories}
              saving={saving}
              onSave={handleSavePermissions}
              error={error}
            />
          </TabsContent>
        </Tabs>
      </Modal>
    );
  }

  // ── Channel settings (full — overview + permissions) ──
  return (
    <Modal open={open} onOpenChange={(v) => !v && handleClose()} title={modalTitle} width="lg">
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        {error && <p className="text-sm text-danger mt-2">{error}</p>}

        <TabsContent value="overview">
          <div className="space-y-4">
            <Input
              label="Channel Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
            <Input
              label="Channel Topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={1024}
            />
            <Select
              label="Slowmode"
              options={SLOWMODE_OPTIONS}
              value={slowmode}
              onValueChange={setSlowmode}
            />
            <Switch
              label="Age-Restricted (NSFW)"
              description="Users will see a warning before viewing this channel"
              checked={nsfw}
              onCheckedChange={setNsfw}
            />
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSaveOverview} loading={saving}>
                Save
              </Button>
              <Button variant="danger" onClick={handleDelete} loading={saving}>
                Delete Channel
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="permissions">
          <PermissionsPanel
            overrides={overrides}
            setOverrides={setOverrides}
            overridesLoaded={overridesLoaded}
            selectedRoleId={selectedRoleId}
            setSelectedRoleId={setSelectedRoleId}
            rolesMap={rolesMap}
            permCategories={permCategories}
            saving={saving}
            onSave={handleSavePermissions}
            error={error}
            syncWarning={syncWarning}
          />
        </TabsContent>
      </Tabs>
    </Modal>
  );
}
