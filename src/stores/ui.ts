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

  setActiveServer: (serverId: string | null) => void;
  setActiveChannel: (channelId: string | null) => void;
  toggleSidebar: () => void;
  toggleMemberList: () => void;
  openModal: (modal: string, data?: unknown) => void;
  closeModal: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setCustomCSS: (css: string) => void;
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

      setActiveServer: (serverId) => set({ activeServerId: serverId }),
      setActiveChannel: (channelId) => set({ activeChannelId: channelId }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      toggleMemberList: () => set((state) => ({ memberListVisible: !state.memberListVisible })),
      openModal: (modal, data) => set({ activeModal: modal, modalData: data }),
      closeModal: () => set({ activeModal: null, modalData: null }),
      setTheme: (theme) => set({ theme }),
      setCustomCSS: (css) => set({ customCSS: css }),
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
