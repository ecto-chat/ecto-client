import { create } from 'zustand';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ServerState {
  // TODO: Add state shape
}

export const useServerStore = create<ServerState>()((_set) => ({
  // TODO: Initial state and actions
}));
