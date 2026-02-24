import { useState, useEffect, useCallback } from 'react';
import { Permissions } from 'ecto-shared';
import { X, Check, Minus } from 'lucide-react';

import { Modal, Select, Button, ScrollArea } from '@/ui';

import { useRoleStore } from '@/stores/role';
import { useUiStore } from '@/stores/ui';
import { useHubFiles } from '@/hooks/useHubFiles';

type PermDef = { key: keyof typeof Permissions; label: string; description: string };

const SHARED_ITEM_PERMS: PermDef[] = [
  { key: 'BROWSE_FILES', label: 'View Files', description: 'Allows this role to see this file/folder.' },
  { key: 'UPLOAD_SHARED_FILES', label: 'Upload Files', description: 'Allows this role to upload files to this folder.' },
  { key: 'MANAGE_FILES', label: 'Manage', description: 'Allows this role to delete or edit permissions on this item.' },
];

type TriState = 'allow' | 'deny' | 'inherit';
type OverrideState = { allow: number; deny: number };

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

interface SharedItemPermissionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemType: 'folder' | 'file';
  itemId: string;
  itemName: string;
}

export function SharedItemPermissionsModal({
  open,
  onOpenChange,
  itemType,
  itemId,
  itemName,
}: SharedItemPermissionsModalProps) {
  const serverId = useUiStore((s) => s.activeServerId);
  const rolesMap = useRoleStore((s) => (serverId ? s.roles.get(serverId) : undefined));
  const { getItemOverrides, updateItemOverrides, loadFolders, loadSharedFiles, currentFolderId } = useHubFiles();

  const [overrides, setOverrides] = useState<Map<string, OverrideState>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load existing overrides on open
  useEffect(() => {
    if (!open) return;
    setLoaded(false);
    setError('');
    setSelectedRoleId(null);
    getItemOverrides(itemType, itemId).then((result) => {
      const map = new Map<string, OverrideState>();
      for (const o of result) {
        map.set(o.target_id, { allow: o.allow, deny: o.deny });
      }
      setOverrides(map);
      setLoaded(true);
    }).catch(() => {
      setError('Failed to load permissions');
      setLoaded(true);
    });
  }, [open, itemType, itemId, getItemOverrides]);

  const getPermState = useCallback((roleId: string, permBit: number): TriState => {
    const o = overrides.get(roleId);
    if (!o) return 'inherit';
    if (o.allow & permBit) return 'allow';
    if (o.deny & permBit) return 'deny';
    return 'inherit';
  }, [overrides]);

  const setPermState = useCallback((roleId: string, permBit: number, state: TriState) => {
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
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = [...overrides.entries()].map(([targetId, o]) => ({
        target_type: 'role' as const,
        target_id: targetId,
        allow: o.allow,
        deny: o.deny,
      }));
      await updateItemOverrides(itemType, itemId, payload);
      onOpenChange(false);
      // Reload folder listing to reflect changes
      await Promise.all([loadFolders(currentFolderId), loadSharedFiles(currentFolderId)]);
    } catch {
      setError('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const roles = rolesMap ? [...rolesMap.values()].sort((a, b) => b.position - a.position) : [];
  const roleOptions = roles.map((r) => ({ value: r.id, label: r.is_default ? '@everyone' : r.name }));

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Permissions — ${itemName}`}>
      <div className="space-y-4">
        {error && <p className="text-sm text-danger">{error}</p>}
        {!loaded ? (
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
                <div className="space-y-1 pr-2">
                  {SHARED_ITEM_PERMS.map((perm) => {
                    const bit = Permissions[perm.key];
                    const state = getPermState(selectedRoleId, bit);
                    return (
                      <div
                        key={perm.key}
                        className="flex items-center justify-between gap-4 py-2 border-b-2 border-primary last:border-0"
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
              </ScrollArea>
            )}

            <div className="pt-2">
              <Button onClick={handleSave} loading={saving}>
                Save Permissions
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
