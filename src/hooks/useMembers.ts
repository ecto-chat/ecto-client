import { useCallback } from 'react';
import { useMemberStore } from '../stores/member.js';
import { connectionManager } from '../services/connection-manager.js';

export function useMembers(serverId: string) {
  const membersMap = useMemberStore((s) => s.members.get(serverId));

  const members = membersMap ? [...membersMap.values()] : [];

  const loadMembers = useCallback(async () => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    const result = await trpc.members.list.query({ limit: 100 });
    useMemberStore.getState().setMembers(serverId, result.members);
  }, [serverId]);

  const kickMember = useCallback(
    async (userId: string, reason?: string) => {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) return;
      await trpc.members.kick.mutate({ user_id: userId, reason });
    },
    [serverId],
  );

  const banMember = useCallback(
    async (userId: string, reason?: string) => {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (!trpc) return;
      await trpc.members.ban.mutate({ user_id: userId, reason });
    },
    [serverId],
  );

  return { members, membersMap, loadMembers, kickMember, banMember };
}
