import type { Channel, Category, Member, Role, VoiceState, ReadState, PresenceStatus, Friend, FriendRequest } from 'ecto-shared';
import { MainWebSocket } from './main-ws.js';
import { NotifyWebSocket } from './notify-ws.js';
import { CentralWebSocket, type CentralReadyData } from './central-ws.js';
import { createServerTrpcClient, createCentralTrpcClient } from './trpc.js';
import type { ServerTrpcClient, CentralTrpcClient } from '../types/trpc.js';
import { useChannelStore } from '../stores/channel.js';
import { useMemberStore } from '../stores/member.js';
import { usePresenceStore } from '../stores/presence.js';
import { useReadStateStore } from '../stores/read-state.js';
import { useVoiceStore } from '../stores/voice.js';
import { resetVoiceSessionState } from './voice-media.js';
import { useConnectionStore } from '../stores/connection.js';
import { useNotifyStore } from '../stores/notify.js';
import { useFriendStore } from '../stores/friend.js';
import { useDmStore } from '../stores/dm.js';
import { useAuthStore } from '../stores/auth.js';
import { useUiStore } from '../stores/ui.js';
import { useServerStore } from '../stores/server.js';
import { useRoleStore } from '../stores/role.js';
import { useCallStore } from '../stores/call.js';
import { useServerDmStore } from '../stores/server-dm.js';
import { useActivityStore } from '../stores/activity.js';
import { useMessageStore } from '../stores/message.js';
import {
  getStoredServerSessions,
  storeServerSession,
  updateStoredServerMeta,
  removeStoredServerSession,
  clearStoredServerSessions,
  storeLocalCredentials,
  getStoredLocalCredentials,
  clearLocalCredentials,
} from './storage-manager.js';
import { parseTokenExp } from '../lib/jwt.js';
import { handleMainEvent } from './server-event-handler.js';
import { handleCentralEvent } from './central-event-handler.js';
import { ReconnectionManager } from './reconnection-manager.js';

function toServerUrl(address: string): string {
  if (address.startsWith('http://') || address.startsWith('https://')) {
    return address.replace(/\/+$/, '');
  }
  // Use HTTPS for public domains, HTTP for localhost/LAN
  const isLocal = /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address);
  const protocol = isLocal ? 'http' : 'https';
  return `${protocol}://${address}`.replace(/\/+$/, '');
}

interface ServerConnection {
  address: string;
  token: string;
  serverId: string;
  mainWs: MainWebSocket | null;
  notifyWs: NotifyWebSocket | null;
  trpc: ServerTrpcClient;
  tokenRefreshTimer: ReturnType<typeof setTimeout> | null;
}

class ConnectionManager {
  private activeServerId: string | null = null;
  private connections = new Map<string, ServerConnection>();
  private centralWs: CentralWebSocket | null = null;
  private centralTrpc: CentralTrpcClient | null = null;
  private reconnection = new ReconnectionManager();

  // Re-export storage methods for backwards compatibility
  getStoredServerSessions = getStoredServerSessions;
  storeServerSession = storeServerSession;
  removeStoredServerSession = removeStoredServerSession;
  clearStoredServerSessions = clearStoredServerSessions;
  storeLocalCredentials = storeLocalCredentials;
  getStoredLocalCredentials = getStoredLocalCredentials;
  clearLocalCredentials = clearLocalCredentials;

  /** Attempt to join a server with local credentials (register flow) */
  async attemptLocalJoin(
    address: string,
    options: { username: string; password: string; inviteCode?: string },
  ): Promise<{ serverId: string } | { error: { ectoCode: number; message: string } }> {
    const serverUrl = toServerUrl(address);

    try {
      const body: Record<string, string> = {
        username: options.username,
        password: options.password,
        action: 'register',
      };
      if (options.inviteCode) {
        body.invite_code = options.inviteCode;
      }

      const res = await fetch(`${serverUrl}/trpc/server.join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as {
          error?: { message?: string; data?: { ecto_code?: number; ecto_error?: string } };
        };
        const ectoCode = errData.error?.data?.ecto_code ?? 0;
        const message = errData.error?.data?.ecto_error ?? errData.error?.message ?? 'Failed to join server';
        return { error: { ectoCode, message } };
      }

      const data = (await res.json()) as {
        result: {
          data: {
            server_token: string;
            server: { id: string; name: string };
          };
        };
      };

      const { server_token, server } = data.result.data;
      await storeServerSession(server.id, serverUrl, server_token);
      const serverId = await this.connectToServerLocal(serverUrl, server_token);
      return { serverId };
    } catch {
      return { error: { ectoCode: 0, message: 'Could not reach server' } };
    }
  }

  // Central connection

  async initialize(centralUrl: string, getToken: () => string | null): Promise<void> {
    this.centralTrpc = createCentralTrpcClient(centralUrl, getToken);
    this.centralWs = new CentralWebSocket();

    this.centralWs.onEvent = (event, data) => handleCentralEvent(event, data);
    this.centralWs.onDisconnect = (code, reason) => {
      console.warn('Central WS disconnected:', code, reason);
      this.reconnection.scheduleReconnect('__central__', async () => {
        await this.centralWs!.connect(centralUrl, getToken()!).catch(() => {});
      });
    };

    const token = getToken();
    if (token) {
      const ready = await this.centralWs.connect(centralUrl, token).catch(() => null);
      if (!ready) return;
      this.populateCentralStores(ready);
    }
  }

  /** Initialize in local-only mode — skip Central, load server sessions from localStorage */
  async initializeLocalOnly(): Promise<void> {
    const sessions = await getStoredServerSessions();
    const toConnect = sessions.filter((s) => !this.connections.has(s.id));
    await Promise.allSettled(
      toConnect.map((session) =>
        this.connectToServerLocal(session.address, session.token).catch(() => {}),
      ),
    );
  }

  /** Connect to a server using a pre-obtained local server token (no server.join call) */
  async connectToServerLocal(address: string, serverToken: string): Promise<string> {
    const serverUrl = toServerUrl(address);

    let serverId: string;
    try {
      const infoRes = await fetch(`${serverUrl}/trpc/server.info`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!infoRes.ok) throw new Error('Failed to fetch server info');
      const infoData = (await infoRes.json()) as {
        result: { data: { server: { id: string; name: string } } };
      };
      serverId = infoData.result.data.server.id;
    } catch {
      throw new Error(`Server unreachable: ${address}`);
    }

    useConnectionStore.getState().setStatus(serverId, 'connecting');

    const trpc = createServerTrpcClient(serverUrl, () => serverToken);
    const conn: ServerConnection = {
      address: serverUrl,
      token: serverToken,
      serverId,
      mainWs: null,
      notifyWs: null,
      trpc,
      tokenRefreshTimer: null,
    };

    this.connections.set(serverId, conn);
    await storeServerSession(serverId, serverUrl, serverToken);

    if (this.activeServerId === null || this.activeServerId === serverId) {
      await this.openMainWs(conn);
      this.activeServerId = serverId;
    } else {
      await this.openNotifyWs(conn);
    }

    return serverId;
  }

  /** Mid-session Central sign-in — establish Central WS/tRPC without touching server connections */
  async initializeCentralMidSession(centralUrl: string, getToken: () => string | null): Promise<void> {
    this.centralTrpc = createCentralTrpcClient(centralUrl, getToken);
    this.centralWs = new CentralWebSocket();

    this.centralWs.onEvent = (event, data) => handleCentralEvent(event, data);
    this.centralWs.onDisconnect = (code, reason) => {
      console.warn('Central WS disconnected:', code, reason);
      this.reconnection.scheduleReconnect('__central__', async () => {
        await this.centralWs!.connect(centralUrl, getToken()!).catch(() => {});
      });
    };

    const token = getToken();
    if (token) {
      const ready = await this.centralWs.connect(centralUrl, token).catch(() => null);
      if (!ready) return;
      this.populateCentralStores(ready);
    }
  }

  private populateCentralStores(ready: CentralReadyData) {
    useFriendStore.getState().setFriends(ready.friends as Friend[]);
    useFriendStore.getState().setIncomingRequests(ready.incoming_requests as FriendRequest[]);
    useFriendStore.getState().setOutgoingRequests(ready.outgoing_requests as FriendRequest[]);
    usePresenceStore.getState().bulkSetPresence(
      ready.presences as { user_id: string; status: PresenceStatus; custom_text?: string }[],
    );
    this.centralTrpc!.dms.list.query().then((convos) => {
      useDmStore.getState().setConversations(convos as import('ecto-shared').DMConversation[]);
    }).catch(() => {});

    if (ready.active_call && useCallStore.getState().callState === 'idle') {
      const ac = ready.active_call as { call_id: string; peer: import('ecto-shared').CallPeerInfo; media_types: ('audio' | 'video')[] };
      useCallStore.getState().setOutgoingCall(ac.call_id, ac.peer, ac.media_types);
      useCallStore.getState().setAnsweredElsewhere();
    }

    if (ready.activity_unread_notifications != null || ready.activity_unread_server_dms != null) {
      useActivityStore.getState().setUnreadCounts(
        ready.activity_unread_notifications ?? 0,
        ready.activity_unread_server_dms ?? 0,
      );
    }
    // Lazy-fetch initial activity items from central
    this.centralTrpc!.activity.list.query({ limit: 30 }).then((res) => {
      useActivityStore.getState().addItems(res.items, 'central', res.has_more);
    }).catch(() => {});
  }

  getCentralTrpc(): CentralTrpcClient | null {
    return this.centralTrpc;
  }

  getCentralWs(): CentralWebSocket | null {
    return this.centralWs;
  }

  // Server connections

  async connectToServer(serverId: string, address: string, token: string, options?: { silent?: boolean; inviteCode?: string; openMainWs?: boolean; activeChannelId?: string | null }): Promise<{ realServerId: string; serverName: string | null; serverIcon: string | null; defaultChannelId: string | null }> {
    if (!options?.silent) {
      useConnectionStore.getState().setStatus(serverId, 'connecting');
    }

    const serverUrl = toServerUrl(address);

    // Check for a cached, non-expired server token to skip server.join
    if (!options?.inviteCode) {
      const sessions = await getStoredServerSessions();
      const cached = sessions.find((s) => s.address === serverUrl);
      if (cached?.tokenExp && cached.tokenExp * 1000 - Date.now() > 5 * 60 * 1000) {
        const cachedServerId = cached.id;
        const trpc = createServerTrpcClient(serverUrl, () => cached.token);
        const conn: ServerConnection = {
          address: serverUrl,
          token: cached.token,
          serverId: cachedServerId,
          mainWs: null,
          notifyWs: null,
          trpc,
          tokenRefreshTimer: null,
        };
        this.connections.set(cachedServerId, conn);

        if (cachedServerId !== serverId) {
          useConnectionStore.getState().removeConnection(serverId);
          useConnectionStore.getState().setStatus(cachedServerId, 'connecting');
        }

        if (options?.openMainWs) {
          await this.openMainWs(conn, options?.activeChannelId);
          this.activeServerId = cachedServerId;
        } else {
          await this.openNotifyWs(conn);
        }

        return {
          realServerId: cachedServerId,
          serverName: cached.serverName ?? null,
          serverIcon: cached.serverIcon ?? null,
          defaultChannelId: cached.defaultChannelId ?? null,
        };
      }
    }

    let realServerId = serverId;
    let serverToken = token;
    const joinBody: Record<string, string> = {};
    if (options?.inviteCode) joinBody.invite_code = options.inviteCode;
    let joinRes: Response;
    try {
      joinRes = await fetch(`${serverUrl}/trpc/server.join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(joinBody),
      });
    } catch {
      useConnectionStore.getState().setStatus(serverId, 'disconnected');
      throw new Error(`Server unreachable: ${address}`);
    }

    let joinData: {
      result: { data: { server_token: string; server: { id: string; name: string; icon_url?: string | null; default_channel_id?: string | null } } };
    };

    if (joinRes.ok) {
      joinData = (await joinRes.json()) as typeof joinData;
      realServerId = joinData.result.data.server.id;
      serverToken = joinData.result.data.server_token;
    } else {
      useConnectionStore.getState().setStatus(serverId, 'disconnected');
      const errData = (await joinRes.json().catch(() => ({}))) as {
        error?: { message?: string; data?: { ecto_code?: number; ecto_error?: string } };
      };
      const ectoCode = errData.error?.data?.ecto_code ?? 0;
      const message = errData.error?.data?.ecto_error ?? errData.error?.message ?? 'Failed to join server';
      const err = new Error(message);
      (err as Error & { ectoCode: number }).ectoCode = ectoCode;
      throw err;
    }

    if (realServerId !== serverId) {
      useConnectionStore.getState().removeConnection(serverId);
      useConnectionStore.getState().setStatus(realServerId, 'connecting');
    }

    const trpc = createServerTrpcClient(serverUrl, () => serverToken);
    const conn: ServerConnection = {
      address: serverUrl,
      token: serverToken,
      serverId: realServerId,
      mainWs: null,
      notifyWs: null,
      trpc,
      tokenRefreshTimer: null,
    };

    this.connections.set(realServerId, conn);

    // Store enriched session with metadata
    await storeServerSession(realServerId, serverUrl, serverToken, {
      tokenExp: parseTokenExp(serverToken),
      serverName: joinData.result.data.server.name,
      serverIcon: joinData.result.data.server.icon_url ?? null,
      defaultChannelId: joinData.result.data.server.default_channel_id ?? null,
    });

    const serverName = joinData.result.data.server.name ?? null;
    const serverIcon = joinData.result.data.server.icon_url ?? null;
    const defaultChannelId = joinData.result.data.server.default_channel_id ?? null;

    if (options?.openMainWs) {
      await this.openMainWs(conn, options?.activeChannelId);
      this.activeServerId = realServerId;
    } else {
      await this.openNotifyWs(conn);
    }

    return { realServerId, serverName, serverIcon, defaultChannelId };
  }

  async switchServer(newServerId: string) {
    const oldId = this.activeServerId;

    if (oldId === newServerId) return;

    if (oldId) {
      const oldConn = this.connections.get(oldId);
      if (oldConn?.mainWs) {
        oldConn.mainWs.disconnect();
        oldConn.mainWs = null;
        await this.openNotifyWs(oldConn).catch(() => {});
      }
    }

    const newConn = this.connections.get(newServerId);
    if (newConn) {
      if (newConn.notifyWs) {
        newConn.notifyWs.disconnect();
        newConn.notifyWs = null;
      }
      await this.openMainWs(newConn);
    }

    this.activeServerId = newServerId;
  }

  getServerTrpc(serverId: string): ServerTrpcClient | null {
    return this.connections.get(serverId)?.trpc ?? null;
  }

  getServerConnection(serverId: string): { address: string; token: string } | null {
    const conn = this.connections.get(serverId);
    if (!conn) return null;
    return { address: conn.address, token: conn.token };
  }

  getAllConnections(): ServerConnection[] {
    return Array.from(this.connections.values());
  }

  getMainWs(serverId: string): MainWebSocket | null {
    return this.connections.get(serverId)?.mainWs ?? null;
  }

  disconnectFromServer(serverId: string) {
    const conn = this.connections.get(serverId);
    if (!conn) return;
    if (conn.tokenRefreshTimer) clearTimeout(conn.tokenRefreshTimer);
    conn.mainWs?.disconnect();
    conn.notifyWs?.disconnect();
    this.connections.delete(serverId);
    useConnectionStore.getState().removeConnection(serverId);
    if (this.activeServerId === serverId) {
      this.activeServerId = null;
    }
  }

  disconnectAll() {
    for (const conn of this.connections.values()) {
      if (conn.tokenRefreshTimer) clearTimeout(conn.tokenRefreshTimer);
      conn.mainWs?.disconnect();
      conn.notifyWs?.disconnect();
    }
    this.connections.clear();
    this.centralWs?.disconnect();
    this.centralWs = null;
    this.centralTrpc = null;
    this.activeServerId = null;
    this.reconnection.stopAllRetries();
  }

  // Server auto-retry for disconnected servers

  startServerRetry(
    address: string,
    onReconnected: (realServerId: string) => void,
  ): void {
    const serverUrl = toServerUrl(address);
    let connecting = false;

    this.reconnection.startServerRetry(address, async () => {
      if (connecting) return;

      const token = useAuthStore.getState().getToken();
      if (!token) {
        connecting = true;
        try {
          const sessions = await getStoredServerSessions();
          const session = sessions.find((s) => s.address === serverUrl || s.address === address);
          if (session) {
            const realId = await this.connectToServerLocal(address, session.token);
            this.reconnection.stopServerRetry(address);
            onReconnected(realId);
          } else {
            this.reconnection.stopServerRetry(address);
          }
        } catch {
          connecting = false;
        }
        return;
      }

      connecting = true;
      try {
        await fetch(serverUrl, { method: 'HEAD' });
        this.reconnection.stopServerRetry(address);
        const { realServerId } = await this.connectToServer(address, address, token!, { silent: true, openMainWs: this.activeServerId === null });
        if (realServerId) onReconnected(realServerId);
      } catch {
        connecting = false;
      }
    });
  }

  stopServerRetry(address: string): void {
    this.reconnection.stopServerRetry(address);
  }

  /** Schedule automatic server token refresh before expiry */
  private scheduleServerTokenRefresh(conn: ServerConnection) {
    if (conn.tokenRefreshTimer) {
      clearTimeout(conn.tokenRefreshTimer);
      conn.tokenRefreshTimer = null;
    }
    try {
      const parts = conn.token.split('.');
      const encoded = parts[1];
      if (!encoded) return;
      const payload = JSON.parse(atob(encoded)) as Record<string, unknown>;
      const exp = payload.exp as number;
      if (!exp) return;
      const msUntilExpiry = exp * 1000 - Date.now();
      // Refresh 5 minutes before expiry, minimum 10 seconds
      const refreshIn = Math.max(msUntilExpiry - 5 * 60 * 1000, 10_000);
      conn.tokenRefreshTimer = setTimeout(async () => {
        try {
          const result = await conn.trpc.server.refreshToken.mutate() as { server_token: string };
          conn.token = result.server_token;
          // Update stored session with new token + exp
          await storeServerSession(conn.serverId, conn.address, result.server_token, {
            tokenExp: parseTokenExp(result.server_token),
          });
          // Recreate trpc client with new token
          conn.trpc = createServerTrpcClient(conn.address, () => conn.token);
          // Schedule next refresh
          this.scheduleServerTokenRefresh(conn);
        } catch {
          // Refresh failed — reconnect from scratch
          this.disconnectFromServer(conn.serverId);
        }
      }, refreshIn);
    } catch {
      // Invalid token format — skip scheduling
    }
  }

  // Private: open Main WS

  private async openMainWs(conn: ServerConnection, activeChannelId?: string | null) {
    const ws = new MainWebSocket();

    ws.onEvent = (event, data, seq) => handleMainEvent(conn.serverId, event, data, seq);
    ws.onDisconnect = (code, reason) => {
      useConnectionStore.getState().setStatus(conn.serverId, 'reconnecting');

      // Clean up voice state if this server owned the active voice session
      const voiceState = useVoiceStore.getState();
      if (voiceState.currentServerId === conn.serverId && voiceState.currentChannelId) {
        useVoiceStore.getState().cleanup();
        resetVoiceSessionState();
      }

      if (ws.isAuthFailure(code)) {
        useConnectionStore.getState().setStatus(conn.serverId, 'disconnected');
        return;
      }
      const reconnect = async () => {
        try {
          await fetch(conn.address, { method: 'HEAD' });
        } catch {
          const attempts = this.reconnection.getAttempts(conn.serverId);
          if (attempts >= 3) {
            useConnectionStore.getState().setStatus(conn.serverId, 'disconnected');
            conn.mainWs = null;
            this.reconnection.resetAttempts(conn.serverId);
            this.startServerRetry(conn.address, (realId) => {
              if (this.activeServerId === conn.serverId || this.activeServerId === realId) {
                useUiStore.getState().setActiveServer(realId);
                this.switchServer(realId).catch(() => {});
              }
            });
          } else {
            this.reconnection.scheduleReconnect(conn.serverId, reconnect);
          }
          return;
        }

        try {
          if (!ws.isInvalidSequence(code) && ws.lastSeq > 0) {
            await ws.resume(conn.address, conn.token, ws.lastSeq);
          } else {
            await ws.connect(conn.address, conn.token);
          }
          useConnectionStore.getState().setStatus(conn.serverId, 'connected');
          this.reconnection.resetAttempts(conn.serverId);
        } catch {
          this.reconnection.scheduleReconnect(conn.serverId, reconnect);
        }
      };
      this.reconnection.scheduleReconnect(conn.serverId, reconnect);
    };

    try {
      const ready = await ws.connect(conn.address, conn.token, activeChannelId);
      conn.mainWs = ws;
      useConnectionStore.getState().setStatus(conn.serverId, 'connected');
      this.reconnection.resetAttempts(conn.serverId);
      this.scheduleServerTokenRefresh(conn);

      const readyData = ready as unknown as {
        user_id?: string;
        server?: { name?: string; icon_url?: string | null; setup_completed?: boolean; admin_user_id?: string | null; default_channel_id?: string | null; banner_url?: string | null; allow_member_dms?: boolean; hosting_mode?: 'self-hosted' | 'managed' };
        channels?: Channel[];
        categories?: Category[];
        members?: Member[];
        roles?: Role[];
        read_states?: ReadState[];
        presences?: { user_id: string; status: PresenceStatus; custom_text?: string }[];
        voice_states?: VoiceState[];
        activity_unread_notifications?: number;
        activity_unread_server_dms?: number;
        initial_messages?: unknown[];
        initial_messages_channel_id?: string;
        initial_messages_has_more?: boolean;
      };

      if (readyData.server) {
        useServerStore.getState().setServerMeta(conn.serverId, {
          setup_completed: readyData.server.setup_completed ?? true,
          admin_user_id: readyData.server.admin_user_id ?? null,
          user_id: readyData.user_id ?? null,
          default_channel_id: readyData.server.default_channel_id ?? null,
          banner_url: readyData.server.banner_url ?? null,
          allow_member_dms: readyData.server.allow_member_dms ?? false,
          hosting_mode: readyData.server.hosting_mode ?? 'self-hosted',
        });
      }

      if (readyData.channels) {
        useChannelStore.getState().setChannels(conn.serverId, readyData.channels);
      }
      if (readyData.categories) {
        useChannelStore.getState().setCategories(conn.serverId, readyData.categories);
      }
      if (readyData.members) {
        useMemberStore.getState().setMembers(conn.serverId, readyData.members);
      }
      if (readyData.roles) {
        useRoleStore.getState().setRoles(conn.serverId, readyData.roles);
      }
      if (readyData.read_states) {
        useReadStateStore.getState().bulkSetReadState(
          readyData.read_states
            .filter((rs) => rs.last_read_message_id !== null)
            .map((rs) => ({
              channel_id: rs.channel_id,
              last_read_message_id: rs.last_read_message_id!,
              mention_count: rs.mention_count,
            })),
        );
      }
      if (readyData.presences) {
        usePresenceStore.getState().bulkSetPresence(readyData.presences);
      }
      if (readyData.voice_states) {
        for (const vs of readyData.voice_states) {
          useVoiceStore.getState().addParticipant(vs);
        }
      }

      // Fetch DM unread counts if server has DMs enabled
      if (readyData.server?.allow_member_dms && conn.trpc) {
        conn.trpc.serverDms.list.query().then((convos) => {
          useServerDmStore.getState().hydrateUnreads(conn.serverId, convos);
        }).catch((err: unknown) => {
          console.warn('[server-dm] Failed to fetch DM list:', err);
        });
      }

      // Activity feed hydration
      if (readyData.activity_unread_notifications != null || readyData.activity_unread_server_dms != null) {
        useActivityStore.getState().setUnreadCounts(
          readyData.activity_unread_notifications ?? 0,
          readyData.activity_unread_server_dms ?? 0,
        );
      }
      if (conn.trpc) {
        conn.trpc.activity.list.query({ limit: 30 }).then((res) => {
          useActivityStore.getState().addItems(res.items, conn.serverId, res.has_more);
        }).catch(() => {});
      }

      // Handle pre-loaded messages from system.ready
      if (readyData.initial_messages?.length && readyData.initial_messages_channel_id) {
        useMessageStore.getState().prependMessages(
          readyData.initial_messages_channel_id,
          readyData.initial_messages as import('ecto-shared').Message[],
          readyData.initial_messages_has_more ?? false,
        );
      }

      // Update cached server metadata after successful ready
      updateStoredServerMeta(conn.serverId, {
        serverName: readyData.server?.name,
        serverIcon: readyData.server?.icon_url,
        defaultChannelId: readyData.server?.default_channel_id,
      }).catch(() => {});

      // Subscribe to active channel (skip if server already subscribed via initial_messages)
      const storeActiveChannelId = activeChannelId ?? useUiStore.getState().activeChannelId;
      if (storeActiveChannelId && storeActiveChannelId !== readyData.initial_messages_channel_id) {
        const { activeServerId: storeActiveServerId } = useUiStore.getState();
        if (storeActiveServerId === conn.serverId || storeActiveServerId === null) {
          ws.subscribe(storeActiveChannelId);
        }
      }
    } catch (err) {
      useConnectionStore.getState().setStatus(conn.serverId, 'disconnected');
      throw err;
    }
  }

  // Private: open Notify WS

  private async openNotifyWs(conn: ServerConnection) {
    const ws = new NotifyWebSocket();

    ws.onNotify = (data) => {
      useNotifyStore.getState().addNotification(conn.serverId, data.channel_id, data.ts, data.type);
      if (data.type === 'mention') {
        useReadStateStore.getState().incrementMention(data.channel_id);
      }
    };

    ws.onDisconnect = (code, reason) => {
      this.reconnection.scheduleReconnect(`notify:${conn.serverId}`, () =>
        ws.connect(conn.address, conn.token).catch(() => {}),
      );
    };

    try {
      await ws.connect(conn.address, conn.token);
      conn.notifyWs = ws;
    } catch {
      // Will retry via reconnect
    }
  }
}

export const connectionManager = new ConnectionManager();
