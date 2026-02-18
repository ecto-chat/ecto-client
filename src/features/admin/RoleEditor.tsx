import { useState, useEffect } from 'react';

import { Plus } from 'lucide-react';

import { Button, ConfirmDialog, IconButton, Input, ScrollArea, Spinner, Tooltip } from '@/ui';

import { connectionManager } from '@/services/connection-manager';

import { cn } from '@/lib/cn';

import type { Role } from 'ecto-shared';

import { PermissionGrid } from './PermissionGrid';

export function RoleEditor({ serverId }: { serverId: string }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#99aab5');
  const [editPerms, setEditPerms] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => { loadRoles(); }, [serverId]);

  const loadRoles = async () => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    try {
      const result = await trpc.roles.list.query();
      const sorted = result.sort((a, b) => b.position - a.position);
      setRoles(sorted);
      if (sorted.length > 0 && !selectedId) selectRole(sorted[0]!);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  const selectRole = (role: Role) => {
    setSelectedId(role.id);
    setEditName(role.name);
    setEditColor(role.color ?? '#99aab5');
    setEditPerms(role.permissions);
    setError('');
  };

  const selectedRole = roles.find((r) => r.id === selectedId) ?? null;

  const handleSave = async () => {
    if (!selectedId) return;
    setError(''); setSaving(true);
    try {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) throw new Error('Not connected');
      const updated = await trpc.roles.update.mutate({ role_id: selectedId, name: editName, color: editColor, permissions: editPerms });
      setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to save role'); } finally { setSaving(false); }
  };

  const handleCreate = async () => {
    setError('');
    try {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) throw new Error('Not connected');
      const created = await trpc.roles.create.mutate({ name: 'New Role' });
      setRoles((prev) => [created, ...prev].sort((a, b) => b.position - a.position));
      selectRole(created);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to create role'); }
  };

  const handleDelete = async () => {
    if (!selectedId || !selectedRole) return;
    setError('');
    try {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) throw new Error('Not connected');
      await trpc.roles.delete.mutate({ role_id: selectedId });
      const remaining = roles.filter((r) => r.id !== selectedId);
      setRoles(remaining);
      if (remaining.length > 0) selectRole(remaining[0]!); else setSelectedId(null);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to delete role'); }
    setDeleteOpen(false);
  };

  if (loading) return <div className="flex items-center justify-center py-10"><Spinner /></div>;

  return (
    <div className="flex gap-4 min-h-[25rem]">
      <div className="min-w-44 border-r border-border pr-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-primary">Roles</h3>
          <Tooltip content="Create Role">
            <IconButton size="sm" onClick={handleCreate}><Plus size={16} /></IconButton>
          </Tooltip>
        </div>
        <ScrollArea className="max-h-80">
          {roles.map((role) => (
            <Button
              key={role.id}
              variant="ghost"
              onClick={() => selectRole(role)}
              className={cn(
                'flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-sm h-auto justify-start font-normal mb-0.5',
                selectedId === role.id ? 'bg-active text-primary' : 'text-secondary hover:bg-hover',
              )}
            >
              <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: role.color ?? '#99aab5' }} />
              <span className="truncate">{role.name}</span>
            </Button>
          ))}
        </ScrollArea>
      </div>

      <div className="flex-1 space-y-4">
        {!selectedRole ? (
          <p className="text-sm text-secondary">Select a role to edit.</p>
        ) : (
          <>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Input label="Role Name" value={editName} onChange={(e) => setEditName(e.target.value)} disabled={selectedRole.is_default} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-secondary">Color</label>
                <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="size-9 border-none cursor-pointer bg-transparent" />
              </div>
            </div>

            <PermissionGrid permissions={editPerms} onChange={setEditPerms} />

            <div className="flex justify-between">
              {!selectedRole.is_default && (
                <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>Delete Role</Button>
              )}
              <div className="ml-auto">
                <Button size="sm" loading={saving} onClick={handleSave}>Save</Button>
              </div>
            </div>

            <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete Role"
              description={`Delete role "${selectedRole.name}"? This cannot be undone.`}
              variant="danger" confirmLabel="Delete" onConfirm={handleDelete} />
          </>
        )}
      </div>
    </div>
  );
}
