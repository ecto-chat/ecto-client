import { create } from 'zustand';

import { preferenceManager } from '../services/preference-manager.js';

interface UiStore {
  activeServerId: string | null;
  activeChannelId: string | null;
  sidebarCollapsed: boolean;
  memberListVisible: boolean;
  activeModal: string | null;
  modalData: unknown;
  theme: 'dark' | 'light';
  customCSS: string;
  channelSettingsId: string | null;
  channelLocked: boolean;
  nsfwDismissed: Set<string>;
  bypassNsfwWarnings: boolean;
  mediaViewMode: 'fullscreen' | 'floating' | 'snapped-left' | 'snapped-right';
  snappedSidebarWidth: number;
  hubSection: string | null;

  setActiveServer: (serverId: string | null) => void;
  setActiveChannel: (channelId: string | null) => void;
  setHubSection: (section: string | null) => void;
  setChannelLocked: (locked: boolean) => void;
  setMediaViewMode: (mode: 'fullscreen' | 'floating' | 'snapped-left' | 'snapped-right') => void;
  setSnappedSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;
  toggleMemberList: () => void;
  openModal: (modal: string, data?: unknown) => void;
  closeModal: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setCustomCSS: (css: string) => void;
  setChannelSettingsId: (id: string | null) => void;
  dismissNsfw: (channelId: string) => void;
  setBypassNsfwWarnings: (bypass: boolean) => void;
  hydrateFromPreferences: () => void;
}

export const useUiStore = create<UiStore>()((set) => ({
  activeServerId: null,
  activeChannelId: null,
  sidebarCollapsed: preferenceManager.getDevice('sidebar-collapsed', false),
  memberListVisible: preferenceManager.getDevice('member-list-visible', true),
  activeModal: null,
  modalData: null,
  theme: preferenceManager.getDevice<'dark' | 'light'>('theme', 'dark'),
  customCSS: preferenceManager.getDevice('custom-css', ''),
  channelSettingsId: null,
  channelLocked: false,
  nsfwDismissed: new Set(preferenceManager.getUser<string[]>('nsfw-dismissed', [])),
  bypassNsfwWarnings: preferenceManager.getDevice('bypass-nsfw', false),
  mediaViewMode: 'fullscreen',
  hubSection: null,
  snappedSidebarWidth: preferenceManager.getDevice('snapped-width', 360),

  setActiveServer: (serverId) => {
    if (serverId) preferenceManager.setUser('last-active-server', serverId);
    set({ activeServerId: serverId });
  },
  setActiveChannel: (channelId) => {
    if (channelId) preferenceManager.setUser('last-active-channel', channelId);
    set({ activeChannelId: channelId, channelLocked: false, hubSection: null });
  },
  setHubSection: (section) => set({ hubSection: section, activeChannelId: null }),
  setChannelLocked: (locked) => set({ channelLocked: locked }),
  toggleSidebar: () => set((state) => {
    const next = !state.sidebarCollapsed;
    preferenceManager.setDevice('sidebar-collapsed', next);
    return { sidebarCollapsed: next };
  }),
  toggleMemberList: () => set((state) => {
    const next = !state.memberListVisible;
    preferenceManager.setDevice('member-list-visible', next);
    return { memberListVisible: next };
  }),
  openModal: (modal, data) => set({ activeModal: modal, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),
  setTheme: (theme) => {
    preferenceManager.setDevice('theme', theme);
    set({ theme });
  },
  setCustomCSS: (css) => {
    preferenceManager.setDevice('custom-css', css);
    set({ customCSS: css });
  },
  setChannelSettingsId: (id) => set({ channelSettingsId: id }),
  dismissNsfw: (channelId) => set((state) => {
    const next = new Set(state.nsfwDismissed);
    next.add(channelId);
    preferenceManager.setUser('nsfw-dismissed', [...next]);
    return { nsfwDismissed: next };
  }),
  setBypassNsfwWarnings: (bypass) => {
    preferenceManager.setDevice('bypass-nsfw', bypass);
    set({ bypassNsfwWarnings: bypass });
  },
  setMediaViewMode: (mode) => set({ mediaViewMode: mode }),
  setSnappedSidebarWidth: (width) => {
    preferenceManager.setDevice('snapped-width', width);
    set({ snappedSidebarWidth: width });
  },
  hydrateFromPreferences: () => set((state) => ({
    nsfwDismissed: new Set(preferenceManager.getUser<string[]>('nsfw-dismissed', [])),
    activeServerId: state.activeServerId ?? preferenceManager.getUser<string | null>('last-active-server', null),
    activeChannelId: state.activeChannelId ?? preferenceManager.getUser<string | null>('last-active-channel', null),
  })),
}));
