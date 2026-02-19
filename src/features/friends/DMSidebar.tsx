import { useNavigate } from 'react-router-dom';

import { motion } from 'motion/react';
import { Users, Settings, Lock } from 'lucide-react';

import { Avatar, IconButton, ScrollArea, Separator, EmptyState, Button } from '@/ui';
import { useDmStore } from '@/stores/dm';
import { usePresenceStore } from '@/stores/presence';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

import { cn } from '@/lib/cn';

import type { PresenceStatus } from 'ecto-shared';

export function DMSidebar() {
  const conversations = useDmStore((s) => s.conversations);
  const presences = usePresenceStore((s) => s.presences);
  const openConversationId = useDmStore((s) => s.openConversationId);
  const centralAuthState = useAuthStore((s) => s.centralAuthState);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const isCentral = centralAuthState === 'authenticated';

  const sortedConversations = isCentral
    ? [...conversations.values()].sort((a, b) => {
        const aTime = a.last_message?.created_at ?? '';
        const bTime = b.last_message?.created_at ?? '';
        return bTime.localeCompare(aTime);
      })
    : [];

  return (
    <div className="flex flex-col h-full bg-secondary">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-sm font-semibold text-primary">Direct Messages</h2>
      </div>

      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors',
          openConversationId === null ? 'bg-primary border-l-4 border-[#6f53ef]' : 'hover:bg-primary border-l-4 border-transparent',
        )}
        onClick={() => navigate('/friends')}
      >
        <Users size={18} className="text-secondary" />
        <span className="text-sm font-medium text-primary">Friends</span>
      </div>

      <Separator className="my-2 mx-2" />

      {isCentral ? (
        <>
          <p className="uppercase tracking-wider text-xs text-muted font-semibold px-4 mb-1">
            Direct Messages
          </p>

          <ScrollArea className="flex-1">
            <div>
              {sortedConversations.map((conv, index) => {
                const presence = presences.get(conv.user_id);
                const status = (presence?.status ?? 'offline') as PresenceStatus;
                const isActive = openConversationId === conv.user_id;
                const lastContent = conv.last_message?.content;

                return (
                  <motion.div
                    key={conv.user_id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 + 0.02, duration: 0.2 }}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors',
                      isActive ? 'bg-primary border-l-4 border-[#6f53ef]' : 'hover:bg-primary border-l-4 border-transparent',
                    )}
                    onClick={() => navigate(`/dms/${conv.user_id}`)}
                  >
                    <Avatar src={conv.avatar_url} username={conv.username} size={32} status={status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{conv.username}</p>
                      {lastContent && (
                        <p className="text-xs text-muted truncate">{lastContent}</p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </ScrollArea>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center px-4">
          <EmptyState
            icon={<Lock />}
            title="Sign in"
            description="Sign in to Ecto Central to access DMs."
            action={
              <Button size="sm" onClick={() => useUiStore.getState().openModal('central-sign-in')}>
                Sign in
              </Button>
            }
          />
        </div>
      )}

      <div className="flex items-center gap-2 px-3 py-2 border-t border-border">
        <Avatar src={user?.avatar_url ?? null} username={user?.username ?? '?'} size={32} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary truncate">
            {user?.display_name ?? user?.username ?? 'User'}
          </p>
          <p className="text-xs text-muted">#{user?.discriminator ?? '0000'}</p>
        </div>
        <IconButton
          variant="ghost"
          size="sm"
          tooltip="User Settings"
          onClick={() => useUiStore.getState().openModal('user-settings')}
        >
          <Settings size={16} />
        </IconButton>
      </div>
    </div>
  );
}
