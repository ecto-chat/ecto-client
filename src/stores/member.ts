import { create } from 'zustand';
import type { Member } from 'ecto-shared';

interface MemberStore {
  // serverId → userId → Member
  members: Map<string, Map<string, Member>>;

  setMembers: (serverId: string, memberList: Member[]) => void;
  addMember: (serverId: string, member: Member) => void;
  removeMember: (serverId: string, userId: string) => void;
  updateMember: (serverId: string, userId: string, updates: Partial<Member>) => void;
  clearServer: (serverId: string) => void;
}

export const useMemberStore = create<MemberStore>()((set) => ({
  members: new Map(),

  setMembers: (serverId, memberList) =>
    set((state) => {
      const members = new Map(state.members);
      const serverMembers = new Map<string, Member>();
      for (const m of memberList) {
        serverMembers.set(m.user_id, m);
      }
      members.set(serverId, serverMembers);
      return { members };
    }),

  addMember: (serverId, member) =>
    set((state) => {
      const members = new Map(state.members);
      const serverMembers = new Map(members.get(serverId) ?? new Map());
      serverMembers.set(member.user_id, member);
      members.set(serverId, serverMembers);
      return { members };
    }),

  removeMember: (serverId, userId) =>
    set((state) => {
      const members = new Map(state.members);
      const serverMembers = new Map(members.get(serverId) ?? new Map());
      serverMembers.delete(userId);
      members.set(serverId, serverMembers);
      return { members };
    }),

  updateMember: (serverId, userId, updates) =>
    set((state) => {
      const existing = state.members.get(serverId)?.get(userId);
      if (!existing) return state;
      const members = new Map(state.members);
      const serverMembers = new Map(members.get(serverId)!);
      serverMembers.set(userId, { ...existing, ...updates });
      members.set(serverId, serverMembers);
      return { members };
    }),

  clearServer: (serverId) =>
    set((state) => {
      const members = new Map(state.members);
      members.delete(serverId);
      return { members };
    }),
}));
