import { useCallback } from 'react';
import { useMemberStore, connectionManager } from 'ecto-core';

export function useMembers(serverId: string, channelId?: string) {
  const membersMap = useMemberStore((s) => s.members.get(serverId));
  const channelMemberIds = useMemberStore((s) => channelId ? s.channelMemberIds.get(channelId) : undefined);

  const members = channelId && channelMemberIds
    ? channelMemberIds.map((uid) => membersMap?.get(uid)).filter(Boolean) as NonNullable<ReturnType<NonNullable<typeof membersMap>['get']>>[]
    : membersMap ? [...membersMap.values()] : [];

  const loadMembers = useCallback(async () => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    if (channelId) {
      const result = await trpc.members.list.query({ limit: 100, channel_id: channelId });
      useMemberStore.getState().setChannelMembers(channelId, serverId, result.members, result.total, result.has_more);
    } else {
      const result = await trpc.members.list.query({ limit: 100 });
      useMemberStore.getState().setMembers(serverId, result.members);
    }
  }, [serverId, channelId]);

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
