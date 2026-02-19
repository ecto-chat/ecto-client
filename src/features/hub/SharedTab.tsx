import { useEffect, useState, useMemo, useCallback } from 'react';
import { FolderPlus, Folder } from 'lucide-react';
import { Permissions, hasPermission } from 'ecto-shared';
import type { SharedFolderContributor } from 'ecto-shared';

import { Button, ConfirmDialog } from '@/ui';

import { useHubFiles, fetchAllSharedFiles } from '@/hooks/useHubFiles';
import { usePermissions } from '@/hooks/usePermissions';
import { useUiStore } from '@/stores/ui';
import { useHubFilesStore } from '@/stores/hub-files';

import { BreadcrumbNav } from './BreadcrumbNav';
import { FileBrowserTable, type TableRow } from './FileBrowserTable';
import { UploadDropzone } from './UploadDropzone';
import { CreateFolderDialog } from './CreateFolderDialog';
import { FolderContributorsModal } from './FolderContributorsModal';
import { SharedItemPermissionsModal } from './SharedItemPermissionsModal';
import { QuotaBar } from './QuotaBar';

function ContributorBadge({ userId, username }: { userId: string; username: string }) {
  const serverId = useUiStore((s) => s.activeServerId);
  return (
    <button
      type="button"
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-colors"
      onClick={() => {
        if (serverId) {
          useUiStore.getState().openModal('user-profile', { userId, serverId });
        }
      }}
    >
      {username}
    </button>
  );
}

function FolderContributorCount({
  contributors,
  onClick,
}: {
  contributors: SharedFolderContributor[];
  onClick: () => void;
}) {
  if (contributors.length === 0) return <span>{'\u2014'}</span>;
  return (
    <button
      type="button"
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-colors"
      onClick={onClick}
    >
      {contributors.length} contributor{contributors.length !== 1 ? 's' : ''}
    </button>
  );
}

export function SharedTab() {
  const serverId = useUiStore((s) => s.activeServerId);
  const { effectivePermissions, isAdmin } = usePermissions(serverId);
  const canUpload = isAdmin || hasPermission(effectivePermissions, Permissions.UPLOAD_SHARED_FILES);
  const canManage = isAdmin || hasPermission(effectivePermissions, Permissions.MANAGE_FILES);

  const {
    sharedFolders,
    sharedFiles,
    sharedHasMore,
    breadcrumb,
    currentFolderId,
    quota,
    loadFolders,
    loadSharedFiles,
    loadQuota,
    createFolder,
    deleteFolder,
    deleteSharedFile,
    uploadSharedFile,
    navigateToFolder,
    navigateToBreadcrumb,
  } = useHubFiles();

  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'folder' | 'file'; id: string; name: string } | null>(null);
  const [contributorModal, setContributorModal] = useState<{ folderName: string; contributors: SharedFolderContributor[] } | null>(null);
  const [permissionsTarget, setPermissionsTarget] = useState<{ type: 'folder' | 'file'; id: string; name: string } | null>(null);

  const openContributorModal = useCallback((folderName: string, contributors: SharedFolderContributor[]) => {
    setContributorModal({ folderName, contributors });
  }, []);

  const reloadTrigger = useHubFilesStore((s) => s.reloadTrigger);

  useEffect(() => {
    loadFolders(currentFolderId);
    loadSharedFiles(currentFolderId);
    loadQuota();
  }, [currentFolderId, loadFolders, loadSharedFiles, loadQuota, reloadTrigger]);

  const handleCreateFolder = async (name: string) => {
    await createFolder(name, currentFolderId);
    setShowCreateFolder(false);
    await loadFolders(currentFolderId);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'folder') {
      await deleteFolder(deleteConfirm.id);
      await loadFolders(currentFolderId);
    } else {
      await deleteSharedFile(deleteConfirm.id);
    }
    setDeleteConfirm(null);
    await loadQuota();
  };

  const tableRows: TableRow[] = useMemo(() => {
    const folderRows: TableRow[] = sharedFolders.map((folder) => ({
      kind: 'folder' as const,
      id: folder.id,
      name: folder.name,
      icon: <Folder size={18} className="text-accent flex-shrink-0" />,
      date: folder.created_at,
      size: folder.total_size_bytes,
      subtitle: `${folder.file_count} file${folder.file_count !== 1 ? 's' : ''}`,
      contributorNode: (
        <FolderContributorCount
          contributors={folder.contributors}
          onClick={() => openContributorModal(folder.name, folder.contributors)}
        />
      ),
      onOpen: () => navigateToFolder(folder.id, folder.name),
      onDelete: (canManage || canUpload) ? () => setDeleteConfirm({ type: 'folder', id: folder.id, name: folder.name }) : undefined,
      loadDownloadFiles: () => fetchAllSharedFiles(folder.id),
      hasOverrides: folder.has_overrides,
      onEditPermissions: canManage ? () => setPermissionsTarget({ type: 'folder', id: folder.id, name: folder.name }) : undefined,
    }));

    const fileRows: TableRow[] = sharedFiles.map((file) => ({
      kind: 'file' as const,
      id: file.id,
      name: file.filename,
      url: file.url,
      contentType: file.content_type,
      date: file.created_at,
      size: file.size_bytes,
      contributor: file.uploaded_by_name,
      contributorNode: <ContributorBadge userId={file.uploaded_by} username={file.uploaded_by_name} />,
      onDelete: (canManage || canUpload) ? () => setDeleteConfirm({ type: 'file', id: file.id, name: file.filename }) : undefined,
      hasOverrides: file.has_overrides,
      onEditPermissions: canManage ? () => setPermissionsTarget({ type: 'file', id: file.id, name: file.filename }) : undefined,
    }));

    return [...folderRows, ...fileRows];
  }, [sharedFolders, sharedFiles, canManage, canUpload, navigateToFolder, openContributorModal]);

  const isEmpty = sharedFolders.length === 0 && sharedFiles.length === 0 && !showCreateFolder;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <BreadcrumbNav breadcrumb={breadcrumb} onNavigate={navigateToBreadcrumb} />
        {canUpload && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowCreateFolder(true)}
          >
            <FolderPlus size={16} />
            New Folder
          </Button>
        )}
      </div>

      {showCreateFolder && (
        <CreateFolderDialog
          onSubmit={handleCreateFolder}
          onCancel={() => setShowCreateFolder(false)}
        />
      )}

      {canUpload && (
        <UploadDropzone onUpload={(file, onProgress) => uploadSharedFile(file, currentFolderId, onProgress)} />
      )}

      <FileBrowserTable
        rows={isEmpty ? [] : tableRows}
        hasMore={sharedHasMore}
        onLoadMore={() => {
          const last = sharedFiles[sharedFiles.length - 1];
          if (last) loadSharedFiles(currentFolderId, last.id);
        }}
        emptyTitle="No files yet"
        emptyDescription={canUpload ? 'Upload files or create folders to get started.' : 'No shared files have been uploaded.'}
      />

      <QuotaBar quota={quota} />

      <ConfirmDialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}
        title={`Delete ${deleteConfirm?.type ?? 'item'}?`}
        description={`Are you sure you want to delete "${deleteConfirm?.name ?? ''}"? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteConfirm}
      />

      <FolderContributorsModal
        open={contributorModal !== null}
        onOpenChange={(open) => { if (!open) setContributorModal(null); }}
        folderName={contributorModal?.folderName ?? ''}
        contributors={contributorModal?.contributors ?? []}
      />

      {permissionsTarget && (
        <SharedItemPermissionsModal
          open={permissionsTarget !== null}
          onOpenChange={(open) => { if (!open) setPermissionsTarget(null); }}
          itemType={permissionsTarget.type}
          itemId={permissionsTarget.id}
          itemName={permissionsTarget.name}
        />
      )}
    </div>
  );
}
