import { useEffect } from 'react';
import { useServerDmStore } from '@/stores/server-dm';
import { useUiStore } from '@/stores/ui';
import { connectionManager } from '@/services/connection-manager';
import { ServerDmConversationList } from './ServerDmConversationList';
import { ServerDmChat } from './ServerDmChat';

export function ServerDmView() {
  const serverId = useUiStore((s) => s.activeServerId);

  // Load conversations on mount
  useEffect(() => {
    if (!serverId) return;
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;

    trpc.serverDms.list.query().then((convos) => {
      useServerDmStore.getState().setConversations(convos);
      useServerDmStore.getState().hydrateUnreads(serverId, convos);
    }).catch(() => {});

    return () => {
      useServerDmStore.getState().clear();
    };
  }, [serverId]);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Conversation sidebar */}
      <div className="flex w-[240px] min-w-[240px] flex-col border-r border-border bg-secondary">
        <div className="flex h-[60px] items-center border-b border-border px-4 shrink-0">
          <h2 className="text-sm font-semibold text-primary">Private Messages</h2>
        </div>
        <ServerDmConversationList />
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col min-w-0">
        <ServerDmChat />
      </div>
    </div>
  );
}
