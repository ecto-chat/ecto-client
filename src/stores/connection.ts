import { create } from 'zustand';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

interface ConnectionStore {
  connections: Map<string, ConnectionStatus>;

  setStatus: (serverId: string, status: ConnectionStatus) => void;
  removeConnection: (serverId: string) => void;
}

export const useConnectionStore = create<ConnectionStore>()((set) => ({
  connections: new Map(),

  setStatus: (serverId, status) =>
    set((state) => {
      const connections = new Map(state.connections);
      connections.set(serverId, status);
      return { connections };
    }),

  removeConnection: (serverId) =>
    set((state) => {
      const connections = new Map(state.connections);
      connections.delete(serverId);
      return { connections };
    }),
}));
