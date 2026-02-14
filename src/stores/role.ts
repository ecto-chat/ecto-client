import { create } from 'zustand';
import type { Role } from 'ecto-shared';

interface RoleStore {
  // serverId → roleId → Role
  roles: Map<string, Map<string, Role>>;

  setRoles: (serverId: string, roleList: Role[]) => void;
  addRole: (serverId: string, role: Role) => void;
  updateRole: (serverId: string, roleId: string, updates: Partial<Role>) => void;
  removeRole: (serverId: string, roleId: string) => void;
  clearServer: (serverId: string) => void;
}

export const useRoleStore = create<RoleStore>()((set) => ({
  roles: new Map(),

  setRoles: (serverId, roleList) =>
    set((state) => {
      const roles = new Map(state.roles);
      const serverRoles = new Map<string, Role>();
      for (const r of roleList) {
        serverRoles.set(r.id, r);
      }
      roles.set(serverId, serverRoles);
      return { roles };
    }),

  addRole: (serverId, role) =>
    set((state) => {
      const roles = new Map(state.roles);
      const serverRoles = new Map(roles.get(serverId) ?? new Map());
      serverRoles.set(role.id, role);
      roles.set(serverId, serverRoles);
      return { roles };
    }),

  updateRole: (serverId, roleId, updates) =>
    set((state) => {
      const existing = state.roles.get(serverId)?.get(roleId);
      if (!existing) return state;
      const roles = new Map(state.roles);
      const serverRoles = new Map(roles.get(serverId)!);
      serverRoles.set(roleId, { ...existing, ...updates });
      roles.set(serverId, serverRoles);
      return { roles };
    }),

  removeRole: (serverId, roleId) =>
    set((state) => {
      const roles = new Map(state.roles);
      const serverRoles = new Map(roles.get(serverId) ?? new Map());
      serverRoles.delete(roleId);
      roles.set(serverId, serverRoles);
      return { roles };
    }),

  clearServer: (serverId) =>
    set((state) => {
      const roles = new Map(state.roles);
      roles.delete(serverId);
      return { roles };
    }),
}));
