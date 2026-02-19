import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

  setActiveServer: (serverId: string | null) => void;
  setActiveChannel: (channelId: string | null) => void;
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
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      activeServerId: null,
      activeChannelId: null,
      sidebarCollapsed: false,
      memberListVisible: true,
      activeModal: null,
      modalData: null,
      theme: 'dark',
      customCSS: '',
      channelSettingsId: null,
      channelLocked: false,
      nsfwDismissed: new Set(
        (() => { try { return JSON.parse(localStorage.getItem('ecto-nsfw-dismissed') ?? '[]') as string[]; } catch { return []; } })(),
      ),
      bypassNsfwWarnings: localStorage.getItem('ecto-bypass-nsfw') === 'true',
      mediaViewMode: 'fullscreen',
      snappedSidebarWidth: (() => { try { const v = localStorage.getItem('ecto-snapped-width'); return v ? Number(v) : 360; } catch { return 360; } })(),

      setActiveServer: (serverId) => set({ activeServerId: serverId }),
      setActiveChannel: (channelId) => set({ activeChannelId: channelId, channelLocked: false }),
      setChannelLocked: (locked) => set({ channelLocked: locked }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      toggleMemberList: () => set((state) => ({ memberListVisible: !state.memberListVisible })),
      openModal: (modal, data) => set({ activeModal: modal, modalData: data }),
      closeModal: () => set({ activeModal: null, modalData: null }),
      setTheme: (theme) => set({ theme }),
      setCustomCSS: (css) => set({ customCSS: css }),
      setChannelSettingsId: (id) => set({ channelSettingsId: id }),
      dismissNsfw: (channelId) => set((state) => {
        const next = new Set(state.nsfwDismissed);
        next.add(channelId);
        localStorage.setItem('ecto-nsfw-dismissed', JSON.stringify([...next]));
        return { nsfwDismissed: next };
      }),
      setBypassNsfwWarnings: (bypass) => {
        localStorage.setItem('ecto-bypass-nsfw', String(bypass));
        set({ bypassNsfwWarnings: bypass });
      },
      setMediaViewMode: (mode) => set({ mediaViewMode: mode }),
      setSnappedSidebarWidth: (width) => {
        localStorage.setItem('ecto-snapped-width', String(width));
        set({ snappedSidebarWidth: width });
      },
    }),
    {
      name: 'ecto-ui',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        memberListVisible: state.memberListVisible,
        theme: state.theme,
        customCSS: state.customCSS,
        activeServerId: state.activeServerId,
      }),
    },
  ),
);
