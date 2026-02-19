import { useCallback } from 'react';
import { useHubFilesStore } from '../stores/hub-files.js';
import { useUiStore } from '../stores/ui.js';
import { connectionManager } from '../services/connection-manager.js';

function getTrpc() {
  const serverId = useUiStore.getState().activeServerId;
  if (!serverId) return null;
  return connectionManager.getServerTrpc(serverId);
}

export function useHubFiles() {
  const store = useHubFilesStore();

  const loadFolders = useCallback(async (parentId: string | null) => {
    const trpc = getTrpc();
    if (!trpc) return;
    const folders = await trpc.hubFiles.listFolders.query({ parent_id: parentId });
    useHubFilesStore.getState().setSharedFolders(folders);
  }, []);

  const loadSharedFiles = useCallback(async (folderId: string | null, cursor?: string) => {
    const trpc = getTrpc();
    if (!trpc) return;
    const result = await trpc.hubFiles.listSharedFiles.query({ folder_id: folderId, cursor });
    if (cursor) {
      useHubFilesStore.getState().appendSharedFiles(result.files, result.has_more);
    } else {
      useHubFilesStore.getState().setSharedFiles(result.files, result.has_more);
    }
  }, []);

  const loadChannelFiles = useCallback(async (channelId?: string, cursor?: string) => {
    const trpc = getTrpc();
    if (!trpc) return;
    const result = await trpc.hubFiles.listChannelFiles.query({ channel_id: channelId, cursor });
    if (cursor) {
      useHubFilesStore.getState().appendChannelFiles(result.files, result.has_more);
    } else {
      useHubFilesStore.getState().setChannelFiles(result.files, result.has_more);
    }
  }, []);

  const loadQuota = useCallback(async () => {
    const trpc = getTrpc();
    if (!trpc) return;
    const quota = await trpc.hubFiles.getStorageQuota.query();
    useHubFilesStore.getState().setQuota(quota);
  }, []);

  const createFolder = useCallback(async (name: string, parentId: string | null) => {
    const trpc = getTrpc();
    if (!trpc) return;
    await trpc.hubFiles.createFolder.mutate({ name, parent_id: parentId });
  }, []);

  const renameFolder = useCallback(async (folderId: string, name: string) => {
    const trpc = getTrpc();
    if (!trpc) return;
    await trpc.hubFiles.renameFolder.mutate({ folder_id: folderId, name });
  }, []);

  const deleteFolder = useCallback(async (folderId: string) => {
    const trpc = getTrpc();
    if (!trpc) return;
    await trpc.hubFiles.deleteFolder.mutate({ folder_id: folderId });
  }, []);

  const deleteSharedFile = useCallback(async (fileId: string) => {
    const trpc = getTrpc();
    if (!trpc) return;
    await trpc.hubFiles.deleteSharedFile.mutate({ file_id: fileId });
  }, []);

  const deleteChannelFile = useCallback(async (attachmentId: string) => {
    const trpc = getTrpc();
    if (!trpc) return;
    await trpc.hubFiles.deleteChannelFile.mutate({ attachment_id: attachmentId });
  }, []);

  const uploadSharedFile = useCallback(async (
    file: File,
    folderId: string | null,
    onProgress?: (pct: number) => void,
  ) => {
    const serverId = useUiStore.getState().activeServerId;
    if (!serverId) throw new Error('No active server');
    const conn = connectionManager.getServerConnection(serverId);
    if (!conn) throw new Error('Not connected to server');

    const formData = new FormData();
    formData.append('file', file);
    if (folderId) formData.append('folder_id', folderId);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${conn.address}/upload/shared`);
      xhr.setRequestHeader('Authorization', `Bearer ${conn.token}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else if (xhr.status === 413) {
          reject(new Error('File is too large. Check the server upload size limit.'));
        } else if (xhr.status === 507) {
          reject(new Error('Storage quota exceeded. Free up space or ask an admin to increase the limit.'));
        } else {
          let msg = 'Upload failed';
          try {
            const body = JSON.parse(xhr.responseText);
            if (body.message) msg = body.message;
          } catch { /* ignore */ }
          reject(new Error(msg));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    });

    // Reload quota after upload
    await loadQuota();
  }, [loadQuota]);

  const navigateToFolder = useCallback(async (folderId: string, folderName: string) => {
    useHubFilesStore.getState().navigateToFolder(folderId, folderName);
    await Promise.all([loadFolders(folderId), loadSharedFiles(folderId)]);
  }, [loadFolders, loadSharedFiles]);

  const navigateToBreadcrumb = useCallback(async (index: number) => {
    const breadcrumb = useHubFilesStore.getState().breadcrumb;
    const target = breadcrumb[index];
    if (!target) return;
    useHubFilesStore.getState().navigateToBreadcrumb(index);
    await Promise.all([loadFolders(target.id), loadSharedFiles(target.id)]);
  }, [loadFolders, loadSharedFiles]);

  const loadChannelStats = useCallback(async () => {
    const trpc = getTrpc();
    if (!trpc) return;
    const stats = await trpc.hubFiles.channelFileStats.query();
    useHubFilesStore.getState().setChannelStats(stats);
  }, []);

  const getItemOverrides = useCallback(async (itemType: 'folder' | 'file', itemId: string) => {
    const trpc = getTrpc();
    if (!trpc) return [];
    return trpc.hubFiles.getItemOverrides.query({ item_type: itemType, item_id: itemId });
  }, []);

  const updateItemOverrides = useCallback(async (
    itemType: 'folder' | 'file',
    itemId: string,
    overrides: { target_type: 'role'; target_id: string; allow: number; deny: number }[],
  ) => {
    const trpc = getTrpc();
    if (!trpc) return;
    await trpc.hubFiles.updateItemOverrides.mutate({
      item_type: itemType,
      item_id: itemId,
      permission_overrides: overrides,
    });
  }, []);

  return {
    ...store,
    loadFolders,
    loadSharedFiles,
    loadChannelFiles,
    loadChannelStats,
    loadQuota,
    createFolder,
    renameFolder,
    deleteFolder,
    deleteSharedFile,
    deleteChannelFile,
    uploadSharedFile,
    navigateToFolder,
    navigateToBreadcrumb,
    getItemOverrides,
    updateItemOverrides,
  };
}

/** Fetch all shared files in a folder (paginating through all pages). Non-hook utility. */
export async function fetchAllSharedFiles(folderId: string | null): Promise<{ url: string; filename: string }[]> {
  const trpc = getTrpc();
  if (!trpc) return [];

  const all: { url: string; filename: string }[] = [];
  let cursor: string | undefined;
  for (;;) {
    const result = await trpc.hubFiles.listSharedFiles.query({ folder_id: folderId, cursor, limit: 100 });
    for (const f of result.files) {
      all.push({ url: f.url, filename: f.filename });
    }
    if (!result.has_more || result.files.length === 0) break;
    cursor = result.files[result.files.length - 1]!.id;
  }
  return all;
}

/** Fetch all channel files for a channel (paginating through all pages). Non-hook utility. */
export async function fetchAllChannelFiles(channelId: string): Promise<{ url: string; filename: string }[]> {
  const trpc = getTrpc();
  if (!trpc) return [];

  const all: { url: string; filename: string }[] = [];
  let cursor: string | undefined;
  for (;;) {
    const result = await trpc.hubFiles.listChannelFiles.query({ channel_id: channelId, cursor, limit: 100 });
    for (const f of result.files) {
      all.push({ url: f.url, filename: f.filename });
    }
    if (!result.has_more || result.files.length === 0) break;
    cursor = result.files[result.files.length - 1]!.id;
  }
  return all;
}
