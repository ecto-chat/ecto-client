import { useAuthStore } from '@/stores/auth';
import { useServerStore } from '@/stores/server';
import { useUiStore } from '@/stores/ui';

import { connectionManager } from '@/services/connection-manager';

import type { ServerPreviewInfo, AuthAction } from './DirectConnectForm';

type ServerInfoResponse = {
  result: { data: { server: { id: string; name: string; icon?: string | null }; member_count: number; online_count: number } };
};

type JoinResponse = {
  result: { data: { server_token: string; server: { id: string; name: string }; member: { id: string; user_id: string } } };
};

type JoinErrorResponse = {
  error?: { message?: string; data?: { code?: string } };
};

export async function fetchServerInfo(url: string): Promise<ServerPreviewInfo> {
  const res = await fetch(`${url}/trpc/server.info`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Could not reach server');
  const data = (await res.json()) as ServerInfoResponse;
  const { server, member_count, online_count } = data.result.data;
  return { id: server.id, name: server.name, icon: server.icon, member_count, online_count };
}

export async function joinServer(
  serverUrl: string,
  address: string,
  authAction: AuthAction,
  username: string,
  password: string,
  setupToken: string | null,
  serverIcon: string | null | undefined,
): Promise<void> {
  const body: Record<string, string> = { username, password, action: authAction };
  if (setupToken) body.setup_token = setupToken;

  const res = await fetch(`${serverUrl}/trpc/server.join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errData = (await res.json().catch(() => ({}))) as JoinErrorResponse;
    const code = errData.error?.data?.code;
    if (code === 'SETUP_TOKEN_REQUIRED' || errData.error?.message?.includes('setup_token')) {
      throw new SetupTokenRequiredError();
    }
    throw new Error(errData.error?.message ?? 'Failed to join server');
  }

  const data = (await res.json()) as JoinResponse;
  const { server_token, server } = data.result.data;

  await connectionManager.storeServerSession(server.id, serverUrl, server_token);
  await connectionManager.storeLocalCredentials(username, password);
  useAuthStore.getState().enterLocalOnly();

  const realId = await connectionManager.connectToServerLocal(serverUrl, server_token);
  useServerStore.getState().addServer({
    id: realId,
    server_address: address,
    server_name: server.name,
    server_icon: serverIcon ?? null,
    position: 0,
    joined_at: new Date().toISOString(),
  });
  useUiStore.getState().setActiveServer(realId);
}

export class SetupTokenRequiredError extends Error {
  constructor() {
    super('This server requires a setup token to join.');
    this.name = 'SetupTokenRequiredError';
  }
}
