import { useUiStore } from '@/stores/ui';
import { useServerStore } from '@/stores/server';
import { useMemberStore } from '@/stores/member';
import { connectionManager } from '@/services/connection-manager';

import type { ServerPreviewData } from './types';

export async function getLocalCredentials(): Promise<{ username: string; password: string } | null> {
  const stored = await connectionManager.getStoredLocalCredentials();
  if (stored) return stored;
  const activeServerId = useUiStore.getState().activeServerId;
  if (!activeServerId) return null;
  const meta = useServerStore.getState().serverMeta.get(activeServerId);
  if (!meta?.user_id) return null;
  const serverMembers = useMemberStore.getState().members.get(activeServerId);
  if (!serverMembers) return null;
  const me = serverMembers.get(meta.user_id);
  return me?.username ? null : null;
}

export function detectUsername(): string | null {
  const activeServerId = useUiStore.getState().activeServerId;
  if (!activeServerId) return null;
  const meta = useServerStore.getState().serverMeta.get(activeServerId);
  if (!meta?.user_id) return null;
  const serverMembers = useMemberStore.getState().members.get(activeServerId);
  if (!serverMembers) return null;
  const me = serverMembers.get(meta.user_id);
  return me?.username ?? null;
}

export async function queryServerName(serverId: string, fallback: string): Promise<string> {
  const conn = connectionManager.getServerTrpc(serverId);
  try {
    if (conn) {
      const info = await conn.server.info.query();
      return info.server.name ?? fallback;
    }
  } catch { /* fallback */ }
  return fallback;
}

export function addToServerStore(serverId: string, addr: string, name: string, icon: string | null) {
  useServerStore.getState().addServer({
    id: serverId,
    server_address: addr,
    server_name: name,
    server_icon: icon,
    position: useServerStore.getState().serverOrder.length,
    joined_at: new Date().toISOString(),
  });
  useUiStore.getState().setActiveServer(serverId);
}

export async function fetchServerPreview(addr: string): Promise<ServerPreviewData> {
  const serverUrl = (addr.startsWith('http') ? addr : `http://${addr}`).replace(/\/+$/, '');
  const res = await fetch(`${serverUrl}/trpc/server.info`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Could not reach server');
  const data = (await res.json()) as {
    result: {
      data: {
        server: { id: string; name: string; icon_url?: string | null };
        member_count: number;
        online_count: number;
        require_invite: boolean;
        allow_local_accounts: boolean;
      };
    };
  };
  const info = data.result.data;
  return {
    name: info.server.name,
    icon_url: info.server.icon_url ?? null,
    member_count: info.member_count,
    online_count: info.online_count,
    require_invite: info.require_invite,
    allow_local_accounts: info.allow_local_accounts,
  };
}
