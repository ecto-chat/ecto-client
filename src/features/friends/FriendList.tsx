import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { motion } from 'motion/react';
import { Lock } from 'lucide-react';

import { Tabs, TabsList, TabsTrigger, TabsContent, Badge, ScrollArea, Button, EmptyState } from '@/ui';
import { useFriendStore } from '@/stores/friend';
import { usePresenceStore } from '@/stores/presence';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { useCall } from '@/hooks/useCall';
import { connectionManager } from '@/services/connection-manager';

import type { PresenceStatus } from 'ecto-shared';

import { FriendRow } from './FriendRow';
import { PendingRequests } from './PendingRequests';
import { BlockedList } from './BlockedList';
import { AddFriendForm } from './AddFriendForm';

export function FriendList() {
  const centralAuthState = useAuthStore((s) => s.centralAuthState);

  if (centralAuthState !== 'authenticated') {
    return (
      <EmptyState
        icon={<Lock />}
        title="Sign in to Ecto Central"
        description="Connect your Ecto account to access friends, DMs, and calls."
        action={
          <Button onClick={() => useUiStore.getState().openModal('central-sign-in')}>
            Sign in to Ecto Central
          </Button>
        }
      />
    );
  }

  return <FriendListInner />;
}

function FriendListInner() {
  const friends = useFriendStore((s) => s.friends);
  const pendingIncoming = useFriendStore((s) => s.pendingIncoming);
  const pendingOutgoing = useFriendStore((s) => s.pendingOutgoing);
  const blocked = useFriendStore((s) => s.blocked);
  const presences = usePresenceStore((s) => s.presences);
  const navigate = useNavigate();
  const { startCall, isInCall } = useCall();

  const friendList = [...friends.values()];
  const onlineFriends = friendList.filter((f) => {
    const p = presences.get(f.user_id);
    return p && p.status !== 'offline';
  });

  const handleMessage = (userId: string) => navigate(`/dms/${userId}`);

  const handleRemove = useCallback(async (userId: string) => {
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;
    await centralTrpc.friends.remove.mutate({ user_id: userId });
    useFriendStore.getState().removeFriend(userId);
  }, []);

  const handleCall = useCallback((userId: string) => {
    startCall(userId, ['audio']);
  }, [startCall]);

  const pendingCount = pendingIncoming.size + pendingOutgoing.size;

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      <div className="flex h-[60px] shrink-0 items-center px-4 border-b border-border">
        <h2 className="text-base font-semibold text-primary">Friends</h2>
      </div>
      <Tabs defaultValue="online" className="flex flex-1 flex-col overflow-hidden px-4">
        <TabsList>
          <TabsTrigger value="online">
            Online {onlineFriends.length > 0 && <Badge size="sm" className="ml-1.5">{onlineFriends.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="all">
            All {friendList.length > 0 && <Badge size="sm" className="ml-1.5">{friendList.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending {pendingCount > 0 && <Badge size="sm" className="ml-1.5">{pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="blocked">
            Blocked {blocked.size > 0 && <Badge size="sm" className="ml-1.5">{blocked.size}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="add">Add Friend</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 mt-2">
          <TabsContent value="online">
            {onlineFriends.length === 0
              ? <EmptyState title="No friends online" description="When friends come online, they'll appear here." />
              : <div>
                  {onlineFriends.map((f, i) => (
                    <motion.div key={f.user_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 + 0.02, duration: 0.2 }}>
                      <FriendRow userId={f.user_id} username={f.username} avatarUrl={f.avatar_url}
                        status={(presences.get(f.user_id)?.status ?? 'offline') as PresenceStatus}
                        onMessage={handleMessage} onCall={handleCall} onRemove={handleRemove} isInCall={isInCall} />
                    </motion.div>
                  ))}
                </div>}
          </TabsContent>
          <TabsContent value="all">
            {friendList.length === 0
              ? <EmptyState title="No friends yet" description="Add friends to start chatting." />
              : <div>
                  {friendList.map((f, i) => (
                    <motion.div key={f.user_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 + 0.02, duration: 0.2 }}>
                      <FriendRow userId={f.user_id} username={f.username} avatarUrl={f.avatar_url}
                        status={(presences.get(f.user_id)?.status ?? 'offline') as PresenceStatus}
                        onMessage={handleMessage} onCall={handleCall} onRemove={handleRemove} isInCall={isInCall} />
                    </motion.div>
                  ))}
                </div>}
          </TabsContent>
          <TabsContent value="pending"><PendingRequests /></TabsContent>
          <TabsContent value="blocked"><BlockedList /></TabsContent>
          <TabsContent value="add"><AddFriendForm /></TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
