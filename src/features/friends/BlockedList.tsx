import { useCallback } from 'react';

import { Avatar, Button, EmptyState } from '@/ui';
import { useFriendStore } from '@/stores/friend';
import { connectionManager } from '@/services/connection-manager';

export function BlockedList() {
  const blocked = useFriendStore((s) => s.blocked);

  const handleUnblock = useCallback(async (userId: string) => {
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;
    await centralTrpc.friends.unblock.mutate({ user_id: userId });
    useFriendStore.getState().unblockUser(userId);
  }, []);

  if (blocked.size === 0) {
    return (
      <EmptyState
        title="No blocked users"
        description="Users you block will appear here."
      />
    );
  }

  return (
    <div className="flex flex-col">
      {[...blocked].map((userId) => (
        <div key={userId} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-hover transition-colors">
          <Avatar username={userId} size={40} />
          <p className="flex-1 min-w-0 text-sm font-medium text-primary truncate">{userId}</p>
          <Button variant="secondary" size="sm" onClick={() => handleUnblock(userId)}>
            Unblock
          </Button>
        </div>
      ))}
    </div>
  );
}
