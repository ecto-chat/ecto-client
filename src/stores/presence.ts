import { create } from 'zustand';
import type { PresenceStatus } from 'ecto-shared';

interface PresenceData {
  status: PresenceStatus;
  custom_text?: string;
}

interface PresenceStore {
  presences: Map<string, PresenceData>;

  setPresence: (userId: string, status: PresenceStatus, customText?: string) => void;
  bulkSetPresence: (entries: { user_id: string; status: PresenceStatus; custom_text?: string }[]) => void;
  clearPresence: (userId: string) => void;
}

export const usePresenceStore = create<PresenceStore>()((set) => ({
  presences: new Map(),

  setPresence: (userId, status, customText) =>
    set((state) => {
      const presences = new Map(state.presences);
      presences.set(userId, { status, custom_text: customText });
      return { presences };
    }),

  bulkSetPresence: (entries) =>
    set((state) => {
      const presences = new Map(state.presences);
      for (const e of entries) {
        presences.set(e.user_id, { status: e.status, custom_text: e.custom_text });
      }
      return { presences };
    }),

  clearPresence: (userId) =>
    set((state) => {
      const presences = new Map(state.presences);
      presences.delete(userId);
      return { presences };
    }),
}));
