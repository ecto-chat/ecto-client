import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useServerDmStore } from '@/stores/server-dm';
import { useUiStore } from '@/stores/ui';
import { connectionManager } from '@/services/connection-manager';
import { ServerDmConversationList } from './ServerDmConversationList';
import { ServerDmChat } from './ServerDmChat';

export function ServerDmView() {
  const { serverId: routeServerId, conversationId } = useParams<{ serverId: string; conversationId?: string }>();
  const storeServerId = useUiStore((s) => s.activeServerId);
  const serverId = routeServerId ?? storeServerId;

  // Sync route params to store
  useEffect(() => {
    if (!serverId) return;
    useUiStore.getState().setActiveServer(serverId);
    useUiStore.getState().setHubSection('server-dms');
  }, [serverId]);

  useEffect(() => {
    if (conversationId) {
      useServerDmStore.getState().setActiveConversation(conversationId);
    }
  }, [conversationId]);

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
      <div className="flex w-[240px] min-w-[240px] flex-col border-r-2 border-primary bg-secondary">
        <div className="flex h-[60px] items-center border-b-2 border-primary px-4 shrink-0">
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
