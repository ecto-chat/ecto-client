import { useEffect, useMemo, useState, useCallback, type ReactNode } from 'react';
import { Permissions, hasPermission } from 'ecto-shared';
import type { ChannelFile, Channel, Category, ChannelFileStat, Role } from 'ecto-shared';
import { Folder, Hash, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { ConfirmDialog } from '@/ui';

import { useHubFiles, fetchAllChannelFiles } from '@/hooks/useHubFiles';
import { usePermissions } from '@/hooks/usePermissions';
import { useChannelStore } from '@/stores/channel';
import { useRoleStore } from '@/stores/role';
import { useUiStore } from '@/stores/ui';

import { FileBrowserTable, type TableRow } from './FileBrowserTable';

type BrowseLevel =
  | { type: 'root' }
  | { type: 'category'; categoryId: string; categoryName: string }
  | { type: 'channel'; channelId: string; channelName: string; categoryName: string | null };

// ── Role Badge ──

function RoleBadge({ role }: { role: Role }) {
  const bgColor = role.color ?? '#5865F2';
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap"
      style={{ backgroundColor: `${bgColor}33`, color: bgColor, border: `1px solid ${bgColor}55` }}
    >
      {role.is_default ? '@everyone' : role.name}
    </span>
  );
}

function RoleBadges({ roleIds, rolesMap }: { roleIds: string[]; rolesMap: Map<string, Role> | undefined }) {
  if (!rolesMap || roleIds.length === 0) return <span>{'\u2014'}</span>;

  const roles = roleIds
    .map((id) => rolesMap.get(id))
    .filter((r): r is Role => r != null)
    .sort((a, b) => {
      // Default role (@everyone) last
      if (a.is_default && !b.is_default) return 1;
      if (!a.is_default && b.is_default) return -1;
      return a.position - b.position;
    });

  if (roles.length === 0) return <span>{'\u2014'}</span>;

  return (
    <div className="flex flex-wrap gap-1 overflow-hidden">
      {roles.map((role) => (
        <RoleBadge key={role.id} role={role} />
      ))}
    </div>
  );
}

// ── Helpers ──

/** Aggregate channel stats for a list of channel IDs */
function aggregateStats(
  channelIds: string[],
  statsMap: Map<string, ChannelFileStat>,
): { lastUpload: string | null; totalSize: number; allRoleIds: string[] } {
  let lastUpload: string | null = null;
  let totalSize = 0;
  const roleIdSet = new Set<string>();

  for (const id of channelIds) {
    const stat = statsMap.get(id);
    if (!stat) continue;
    totalSize += stat.total_size_bytes;
    if (stat.last_upload_at) {
      if (!lastUpload || stat.last_upload_at > lastUpload) {
        lastUpload = stat.last_upload_at;
      }
    }
    for (const rid of stat.access_role_ids) roleIdSet.add(rid);
  }

  return { lastUpload, totalSize, allRoleIds: [...roleIdSet] };
}

// ── Component ──

export function ServerTab() {
  const serverId = useUiStore((s) => s.activeServerId);
  const { effectivePermissions, isAdmin } = usePermissions(serverId);
  const canManage = isAdmin || hasPermission(effectivePermissions, Permissions.MANAGE_FILES);

  const channelsMap = useChannelStore((s) => (serverId ? s.channels.get(serverId) : undefined));
  const categoriesMap = useChannelStore((s) => (serverId ? s.categories.get(serverId) : undefined));
  const rolesMap = useRoleStore((s) => (serverId ? s.roles.get(serverId) : undefined));

  const {
    channelFiles,
    channelFilesHasMore,
    channelStats,
    loadChannelFiles,
    loadChannelStats,
    deleteChannelFile,
    setChannelFilter,
  } = useHubFiles();

  const navigate = useNavigate();
  const [level, setLevel] = useState<BrowseLevel>({ type: 'root' });
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // Load channel stats on mount
  useEffect(() => {
    loadChannelStats();
  }, [loadChannelStats]);

  // Build directory structure — filtered to channels the user can access
  const { categoryFolders, uncategorizedChannels } = useMemo(() => {
    if (!channelsMap || !categoriesMap) return { categoryFolders: [], uncategorizedChannels: [] };

    // channelStats only contains entries for channels the user has READ_MESSAGES access to
    const accessibleChannelIds = new Set(channelStats.keys());
    const textChannels = [...channelsMap.values()].filter(
      (ch) => ch.type === 'text' && accessibleChannelIds.has(ch.id),
    );
    const cats = [...categoriesMap.values()].sort((a, b) => a.position - b.position);

    const catFolders = cats
      .map((cat) => ({
        category: cat,
        channels: textChannels
          .filter((ch) => ch.category_id === cat.id)
          .sort((a, b) => a.position - b.position),
      }))
      .filter((cf) => cf.channels.length > 0);

    const uncat = textChannels
      .filter((ch) => !ch.category_id)
      .sort((a, b) => a.position - b.position);

    return { categoryFolders: catFolders, uncategorizedChannels: uncat };
  }, [channelsMap, categoriesMap, channelStats]);

  // Get channels for current category view
  const categoryChannels = useMemo(() => {
    if (level.type !== 'category') return [];
    const cf = categoryFolders.find((f) => f.category.id === level.categoryId);
    return cf?.channels ?? [];
  }, [level, categoryFolders]);

  // Load files when entering a channel
  useEffect(() => {
    if (level.type === 'channel') {
      setChannelFilter(level.channelId);
      loadChannelFiles(level.channelId);
    } else {
      setChannelFilter(null);
    }
  }, [level, loadChannelFiles, setChannelFilter]);

  const openCategory = useCallback((cat: Category) => {
    setLevel({ type: 'category', categoryId: cat.id, categoryName: cat.name });
  }, []);

  const openChannel = useCallback((ch: Channel, categoryName: string | null) => {
    setLevel({ type: 'channel', channelId: ch.id, channelName: ch.name, categoryName });
  }, []);

  const goToRoot = useCallback(() => setLevel({ type: 'root' }), []);

  const goToCategory = useCallback((categoryId: string, categoryName: string) => {
    setLevel({ type: 'category', categoryId, categoryName });
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    await deleteChannelFile(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  const handleGoToMessage = (file: ChannelFile) => {
    if (serverId) {
      useUiStore.getState().setActiveChannel(file.channel_id);
      navigate(`/servers/${serverId}/channels/${file.channel_id}`);
    }
  };

  // Build table rows based on current level
  const tableRows: TableRow[] = useMemo(() => {
    if (level.type === 'root') {
      const catRows: TableRow[] = categoryFolders.map((cf) => {
        const chIds = cf.channels.map((c) => c.id);
        const agg = aggregateStats(chIds, channelStats);
        return {
          kind: 'folder' as const,
          id: cf.category.id,
          name: cf.category.name,
          icon: <Folder size={18} className="text-accent flex-shrink-0" />,
          date: agg.lastUpload ?? undefined,
          size: agg.totalSize > 0 ? agg.totalSize : undefined,
          subtitle: `${cf.channels.length} channel${cf.channels.length !== 1 ? 's' : ''}`,
          contributorNode: <RoleBadges roleIds={agg.allRoleIds} rolesMap={rolesMap} />,
          onOpen: () => openCategory(cf.category),
        };
      });

      const uncatRows: TableRow[] = uncategorizedChannels.map((ch) => {
        const stat = channelStats.get(ch.id);
        return {
          kind: 'folder' as const,
          id: ch.id,
          name: `#${ch.name}`,
          icon: <Hash size={18} className="text-muted flex-shrink-0" />,
          date: stat?.last_upload_at ?? undefined,
          size: stat && stat.total_size_bytes > 0 ? stat.total_size_bytes : undefined,
          contributorNode: stat ? <RoleBadges roleIds={stat.access_role_ids} rolesMap={rolesMap} /> : undefined,
          onOpen: () => openChannel(ch, null),
          loadDownloadFiles: () => fetchAllChannelFiles(ch.id),
        };
      });

      return [...catRows, ...uncatRows];
    }

    if (level.type === 'category') {
      return categoryChannels.map((ch) => {
        const stat = channelStats.get(ch.id);
        return {
          kind: 'folder' as const,
          id: ch.id,
          name: `#${ch.name}`,
          icon: <Hash size={18} className="text-muted flex-shrink-0" />,
          date: stat?.last_upload_at ?? undefined,
          size: stat && stat.total_size_bytes > 0 ? stat.total_size_bytes : undefined,
          contributorNode: stat ? <RoleBadges roleIds={stat.access_role_ids} rolesMap={rolesMap} /> : undefined,
          onOpen: () => openChannel(ch, level.categoryName),
          loadDownloadFiles: () => fetchAllChannelFiles(ch.id),
        };
      });
    }

    // Channel level — show files
    return channelFiles.map((file) => ({
      kind: 'file' as const,
      id: file.id,
      name: file.filename,
      url: file.url,
      contentType: file.content_type,
      date: file.created_at,
      size: file.size_bytes,
      contributor: file.uploaded_by_name,
      onDelete: canManage ? () => setDeleteConfirm({ id: file.id, name: file.filename }) : undefined,
      onGoToMessage: () => handleGoToMessage(file),
    }));
  }, [level, categoryFolders, uncategorizedChannels, categoryChannels, channelFiles, channelStats, rolesMap, canManage, openCategory, openChannel]);

  // Breadcrumb
  const breadcrumb = useMemo(() => {
    const crumbs: { label: string; onClick?: () => void }[] = [
      { label: 'Server', onClick: level.type !== 'root' ? goToRoot : undefined },
    ];
    if (level.type === 'category') {
      crumbs.push({ label: level.categoryName });
    } else if (level.type === 'channel') {
      if (level.categoryName) {
        crumbs.push({
          label: level.categoryName,
          onClick: () => {
            const cat = categoriesMap ? [...categoriesMap.values()].find((c) => c.name === level.categoryName) : undefined;
            if (cat) goToCategory(cat.id, cat.name);
          },
        });
      }
      crumbs.push({ label: `#${level.channelName}` });
    }
    return crumbs;
  }, [level, goToRoot, goToCategory, categoriesMap]);

  const emptyMessages = {
    root: { title: 'No text channels', description: 'This server has no text channels with files.' },
    category: { title: 'No text channels', description: 'This category has no text channels.' },
    channel: { title: 'No files', description: 'No files have been uploaded in this channel.' },
  } as const;

  const empty = emptyMessages[level.type];

  return (
    <div className="space-y-3">
      {/* Breadcrumb */}
      {level.type !== 'root' && (
        <nav className="flex items-center gap-1 text-sm text-muted overflow-x-auto">
          {breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={14} className="flex-shrink-0" />}
              {crumb.onClick ? (
                <button
                  type="button"
                  className="hover:text-primary transition-colors"
                  onClick={crumb.onClick}
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="text-primary font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <FileBrowserTable
        rows={tableRows}
        columnLabels={{ date: 'Last Upload' }}
        hasMore={level.type === 'channel' ? channelFilesHasMore : false}
        onLoadMore={level.type === 'channel' ? () => {
          const last = channelFiles[channelFiles.length - 1];
          if (last) loadChannelFiles(level.channelId, last.id);
        } : undefined}
        emptyTitle={empty.title}
        emptyDescription={empty.description}
      />

      <ConfirmDialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}
        title="Delete attachment?"
        description={`Are you sure you want to delete "${deleteConfirm?.name ?? ''}"? This will remove it from the original message.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
