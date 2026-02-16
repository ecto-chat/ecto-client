import { create } from 'zustand';

export interface Toast {
  id: string;
  serverId: string;
  channelId: string;
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
      const id = String(++nextId);
      return { toasts: [...state.toasts.slice(-4), { ...toast, id }] };
    }),

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
