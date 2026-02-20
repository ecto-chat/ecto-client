import { create } from 'zustand';
import type { SharedFolder, SharedFile, ChannelFile, SharedStorageQuota, ChannelFileStat } from 'ecto-shared';

type ActiveTab = 'shared' | 'server';

interface HubFilesStore {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;

  // Shared tab state
  sharedFolders: SharedFolder[];
  sharedFiles: SharedFile[];
  sharedHasMore: boolean;
  breadcrumb: { id: string | null; name: string }[];
  currentFolderId: string | null;
  quota: SharedStorageQuota | null;

  setSharedFolders: (folders: SharedFolder[]) => void;
  setSharedFiles: (files: SharedFile[], hasMore: boolean) => void;
  appendSharedFiles: (files: SharedFile[], hasMore: boolean) => void;
  addSharedFile: (file: SharedFile) => void;
  removeSharedFile: (fileId: string) => void;
  addSharedFolder: (folder: SharedFolder) => void;
  updateSharedFolder: (folderId: string, updates: Partial<SharedFolder>) => void;
  removeSharedFolder: (folderId: string) => void;
  setQuota: (quota: SharedStorageQuota) => void;
  navigateToFolder: (folderId: string | null, folderName: string) => void;
  navigateToBreadcrumb: (index: number) => void;

  // Server tab state
  channelFiles: ChannelFile[];
  channelFilesHasMore: boolean;
  channelFilter: string | null;
  channelStats: Map<string, ChannelFileStat>;

  setChannelFiles: (files: ChannelFile[], hasMore: boolean) => void;
  appendChannelFiles: (files: ChannelFile[], hasMore: boolean) => void;
  removeChannelFile: (fileId: string) => void;
  setChannelFilter: (channelId: string | null) => void;
  setChannelStats: (stats: ChannelFileStat[]) => void;

  // Reload trigger (incremented when WS events indicate data changed)
  reloadTrigger: number;
  requestReload: () => void;

  // Reset
  clear: () => void;
}

export const useHubFilesStore = create<HubFilesStore>()((set) => ({
  activeTab: 'shared',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Shared tab
  sharedFolders: [],
  sharedFiles: [],
  sharedHasMore: false,
  breadcrumb: [{ id: null, name: 'Root' }],
  currentFolderId: null,
  quota: null,

  setSharedFolders: (folders) => set({ sharedFolders: folders }),
  setSharedFiles: (files, hasMore) => set({ sharedFiles: files, sharedHasMore: hasMore }),
  appendSharedFiles: (files, hasMore) =>
    set((s) => ({ sharedFiles: [...s.sharedFiles, ...files], sharedHasMore: hasMore })),
  addSharedFile: (file) =>
    set((s) => {
      if (file.folder_id !== s.currentFolderId) return s;
      if (s.sharedFiles.some((f) => f.id === file.id)) return s;
      return { sharedFiles: [file, ...s.sharedFiles] };
    }),
  removeSharedFile: (fileId) =>
    set((s) => ({ sharedFiles: s.sharedFiles.filter((f) => f.id !== fileId) })),
  addSharedFolder: (folder) =>
    set((s) => {
      if (folder.parent_id !== s.currentFolderId) return s;
      if (s.sharedFolders.some((f) => f.id === folder.id)) return s;
      return { sharedFolders: [...s.sharedFolders, folder] };
    }),
  updateSharedFolder: (folderId, updates) =>
    set((s) => ({
      sharedFolders: s.sharedFolders.map((f) => (f.id === folderId ? { ...f, ...updates } : f)),
    })),
  removeSharedFolder: (folderId) =>
    set((s) => ({ sharedFolders: s.sharedFolders.filter((f) => f.id !== folderId) })),
  setQuota: (quota) => set({ quota }),
  navigateToFolder: (folderId, folderName) =>
    set((s) => ({
      currentFolderId: folderId,
      breadcrumb: [...s.breadcrumb, { id: folderId, name: folderName }],
      sharedFolders: [],
      sharedFiles: [],
      sharedHasMore: false,
    })),
  navigateToBreadcrumb: (index) =>
    set((s) => {
      const breadcrumb = s.breadcrumb.slice(0, index + 1);
      const last = breadcrumb[breadcrumb.length - 1];
      return {
        currentFolderId: last?.id ?? null,
        breadcrumb,
        sharedFolders: [],
        sharedFiles: [],
        sharedHasMore: false,
      };
    }),

  // Server tab
  channelFiles: [],
  channelFilesHasMore: false,
  channelFilter: null,
  channelStats: new Map(),

  setChannelFiles: (files, hasMore) => set({ channelFiles: files, channelFilesHasMore: hasMore }),
  appendChannelFiles: (files, hasMore) =>
    set((s) => ({ channelFiles: [...s.channelFiles, ...files], channelFilesHasMore: hasMore })),
  removeChannelFile: (fileId) =>
    set((s) => ({ channelFiles: s.channelFiles.filter((f) => f.id !== fileId) })),
  setChannelFilter: (channelId) =>
    set({ channelFilter: channelId, channelFiles: [], channelFilesHasMore: false }),
  setChannelStats: (stats) =>
    set({ channelStats: new Map(stats.map((s) => [s.channel_id, s])) }),

  reloadTrigger: 0,
  requestReload: () => set((s) => ({ reloadTrigger: s.reloadTrigger + 1 })),

  clear: () =>
    set({
      activeTab: 'shared',
      sharedFolders: [],
      sharedFiles: [],
      sharedHasMore: false,
      breadcrumb: [{ id: null, name: 'Root' }],
      currentFolderId: null,
      quota: null,
      channelFiles: [],
      channelFilesHasMore: false,
      channelFilter: null,
      channelStats: new Map(),
    }),
}));
