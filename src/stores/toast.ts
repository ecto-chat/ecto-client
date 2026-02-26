import { create } from 'zustand';
import { showOsNotification } from '../services/notification-service.js';

export interface Toast {
  id: string;
  /** Server ID — empty string for DMs */
  serverId: string;
  /** Channel ID — empty string for DMs */
  channelId: string;
  /** Peer user ID — set for DMs, undefined for server messages */
  peerId?: string;
  /** Server DM conversation ID — set for server DMs */
  conversationId?: string;
  authorName: string;
  avatarUrl?: string;
  content: string;
}

let nextId = 0;

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>()((set) => ({
  toasts: [],

  addToast: (toast) =>
    set((state) => {
      // Skip if user is already viewing this channel/DM/server-DM
      const path = window.location.pathname;
      if (toast.peerId && path === `/dms/${toast.peerId}`) return state;
      if (toast.conversationId && path.endsWith(`/dms/${toast.conversationId}`)) return state;
      if (toast.channelId && path.endsWith(`/channels/${toast.channelId}`)) return state;

      const id = String(++nextId);
      // Also fire an OS notification for every toast
      const data: Record<string, string> = { type: 'toast' };
      if (toast.peerId) {
        data.peerId = toast.peerId;
      } else if (toast.conversationId) {
        data.serverId = toast.serverId;
        data.conversationId = toast.conversationId;
      } else {
        data.serverId = toast.serverId;
        data.channelId = toast.channelId;
      }
      showOsNotification(toast.authorName, toast.content.slice(0, 100), data);
      return { toasts: [...state.toasts.slice(-4), { ...toast, id }] };
    }),

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
