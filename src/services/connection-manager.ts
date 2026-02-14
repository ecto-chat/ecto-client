import type { Channel, Category, Member, Role, VoiceState, ReadState, PresenceStatus, Message, Friend, FriendRequest, DirectMessage } from 'ecto-shared';
import { MainWebSocket } from './main-ws.js';
import { NotifyWebSocket } from './notify-ws.js';
import { CentralWebSocket } from './central-ws.js';
import { createServerTrpcClient, createCentralTrpcClient } from './trpc.js';
import type { ServerTrpcClient, CentralTrpcClient } from '../types/trpc.js';
import { useChannelStore } from '../stores/channel.js';
import { useMemberStore } from '../stores/member.js';
import { usePresenceStore } from '../stores/presence.js';
import { useMessageStore } from '../stores/message.js';
import { useReadStateStore } from '../stores/read-state.js';
import { useVoiceStore } from '../stores/voice.js';
import { useConnectionStore } from '../stores/connection.js';
import { useNotifyStore } from '../stores/notify.js';
import { useFriendStore } from '../stores/friend.js';
import { useDmStore } from '../stores/dm.js';
import { useAuthStore } from '../stores/auth.js';
import { useUiStore } from '../stores/ui.js';
import { useServerStore } from '../stores/server.js';
import { useRoleStore } from '../stores/role.js';
import { handleCallWsEvent } from '../hooks/useCall.js';

const SERVER_TOKENS_KEY = 'ecto-server-tokens';
const LOCAL_CREDENTIALS_KEY = 'ecto-local-credentials';

interface StoredServerSession {
  address: string;
  token: string;
}

interface ServerConnection {
  address: string;
  token: string;
  serverId: string;
  mainWs: MainWebSocket | null;
  notifyWs: NotifyWebSocket | null;
  trpc: ServerTrpcClient;
}

export class ConnectionManager {
  private activeServerId: string | null = null;
  private connections = new Map<string, ServerConnection>();
  private centralWs: CentralWebSocket | null = null;
  private centralTrpc: CentralTrpcClient | null = null;
  private reconnectAttempts = new Map<string, number>();
  private retryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // localStorage server session persistence

  getStoredServerSessions(): Array<{ id: string; address: string; token: string }> {
    try {
      const raw = localStorage.getItem(SERVER_TOKENS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Record<string, StoredServerSession>;
      return Object.entries(parsed).map(([id, session]) => ({
        id,
        address: session.address,
        token: session.token,
      }));
    } catch {
      return [];
    }
  }

  storeServerSession(serverId: string, address: string, token: string): void {
    try {
      const raw = localStorage.getItem(SERVER_TOKENS_KEY);
      const sessions: Record<string, StoredServerSession> = raw ? JSON.parse(raw) as Record<string, StoredServerSession> : {};
      sessions[serverId] = { address, token };
      localStorage.setItem(SERVER_TOKENS_KEY, JSON.stringify(sessions));
    } catch {
      // Storage full or unavailable
    }
  }

  removeStoredServerSession(serverId: string): void {
    try {
      const raw = localStorage.getItem(SERVER_TOKENS_KEY);
      if (!raw) return;
      const sessions: Record<string, StoredServerSession> = JSON.parse(raw) as Record<string, StoredServerSession>;
      delete sessions[serverId];
      localStorage.setItem(SERVER_TOKENS_KEY, JSON.stringify(sessions));
    } catch {
      // Storage unavailable
    }
  }

  clearStoredServerSessions(): void {
    localStorage.removeItem(SERVER_TOKENS_KEY);
  }

  // Local credential storage for multi-server auto-join

  storeLocalCredentials(username: string, password: string): void {
    try {
      localStorage.setItem(LOCAL_CREDENTIALS_KEY, JSON.stringify({ username, password }));
    } catch {
      // Storage full or unavailable
    }
  }

  getStoredLocalCredentials(): { username: string; password: string } | null {
    try {
      const raw = localStorage.getItem(LOCAL_CREDENTIALS_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as { username: string; password: string };
    } catch {
      return null;
    }
  }

  clearLocalCredentials(): void {
    localStorage.removeItem(LOCAL_CREDENTIALS_KEY);
  }

  /** Attempt to join a server with local credentials (register flow) */
  async attemptLocalJoin(
    address: string,
    options: { username: string; password: string; inviteCode?: string },
  ): Promise<{ serverId: string } | { error: { ectoCode: number; message: string } }> {
    const serverUrl = address.startsWith('http') ? address : `http://${address}`;

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
      this.storeServerSession(server.id, serverUrl, server_token);
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

    this.centralWs.onEvent = (event, data) => this.handleCentralEvent(event, data);
    this.centralWs.onDisconnect = (code, reason) => {
      console.warn('Central WS disconnected:', code, reason);
      this.scheduleReconnect('__central__', async () => {
        await this.centralWs!.connect(centralUrl, getToken()!).catch(() => {});
      });
    };

    const token = getToken();
    if (token) {
      const ready = await this.centralWs.connect(centralUrl, token).catch(() => null);
      if (!ready) return;
      // Populate friend/DM stores from ready data
      useFriendStore.getState().setFriends(ready.friends as Friend[]);
      useFriendStore.getState().setIncomingRequests(ready.incoming_requests as FriendRequest[]);
      useFriendStore.getState().setOutgoingRequests(ready.outgoing_requests as FriendRequest[]);
      usePresenceStore.getState().bulkSetPresence(
        ready.presences as { user_id: string; status: PresenceStatus; custom_text?: string }[],
      );
      // Load actual DM conversation list (pending_dms from ready are raw messages, not conversations)
      this.centralTrpc!.dms.list.query().then((convos) => {
        useDmStore.getState().setConversations(convos as import('ecto-shared').DMConversation[]);
      }).catch(() => {});
    }
  }

  /** Initialize in local-only mode — skip Central, load server sessions from localStorage */
  async initializeLocalOnly(): Promise<void> {
    // centralWs and centralTrpc remain null
    const sessions = this.getStoredServerSessions();
    const toConnect = sessions.filter((s) => !this.connections.has(s.id));
    await Promise.allSettled(
      toConnect.map((session) =>
        this.connectToServerLocal(session.address, session.token).catch(() => {
          // Server unreachable — will show as disconnected
        }),
      ),
    );
  }

  /** Connect to a server using a pre-obtained local server token (no server.join call) */
  async connectToServerLocal(address: string, serverToken: string): Promise<string> {
    const serverUrl = address.startsWith('http') ? address : `http://${address}`;

    // Fetch server info to get the real UUID
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
      // If server.info fails, try to connect anyway using the address as ID
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
    };

    this.connections.set(serverId, conn);

    // Store session for persistence
    this.storeServerSession(serverId, serverUrl, serverToken);

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

    this.centralWs.onEvent = (event, data) => this.handleCentralEvent(event, data);
    this.centralWs.onDisconnect = (code, reason) => {
      console.warn('Central WS disconnected:', code, reason);
      this.scheduleReconnect('__central__', async () => {
        await this.centralWs!.connect(centralUrl, getToken()!).catch(() => {});
      });
    };

    const token = getToken();
    if (token) {
      const ready = await this.centralWs.connect(centralUrl, token).catch(() => null);
      if (!ready) return;
      useFriendStore.getState().setFriends(ready.friends as Friend[]);
      useFriendStore.getState().setIncomingRequests(ready.incoming_requests as FriendRequest[]);
      useFriendStore.getState().setOutgoingRequests(ready.outgoing_requests as FriendRequest[]);
      usePresenceStore.getState().bulkSetPresence(
        ready.presences as { user_id: string; status: PresenceStatus; custom_text?: string }[],
      );
      this.centralTrpc!.dms.list.query().then((convos) => {
        useDmStore.getState().setConversations(convos as import('ecto-shared').DMConversation[]);
      }).catch(() => {});
    }
  }

  getCentralTrpc(): CentralTrpcClient | null {
    return this.centralTrpc;
  }

  getCentralWs(): CentralWebSocket | null {
    return this.centralWs;
  }

  // Server connections

  async connectToServer(serverId: string, address: string, token: string, options?: { silent?: boolean }) {
    if (!options?.silent) {
      useConnectionStore.getState().setStatus(serverId, 'connecting');
    }

    // Always call server.join to get the real server UUID and a server token.
    // This is idempotent — existing members get a fresh token.
    const serverUrl = address.startsWith('http') ? address : `http://${address}`;
    let realServerId = serverId;
    let serverToken = token;
    let joinFailed = false;
    try {
      const joinRes = await fetch(`${serverUrl}/trpc/server.join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      if (joinRes.ok) {
        const joinData = (await joinRes.json()) as {
          result: { data: { server_token: string; server: { id: string; name: string } } };
        };
        realServerId = joinData.result.data.server.id;
        serverToken = joinData.result.data.server_token;
      } else {
        joinFailed = true;
      }
    } catch {
      joinFailed = true;
    }

    // If the server is unreachable, mark as disconnected and bail out
    if (joinFailed) {
      useConnectionStore.getState().setStatus(serverId, 'disconnected');
      throw new Error(`Server unreachable: ${address}`);
    }

    // If serverId changed (was an address, now a UUID), clean up the old key
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
    };

    this.connections.set(realServerId, conn);

    if (this.activeServerId === serverId || this.activeServerId === realServerId || this.activeServerId === null) {
      // Open Main WS for active server
      await this.openMainWs(conn);
      this.activeServerId = realServerId;
    } else {
      // Open Notify WS for background server
      await this.openNotifyWs(conn);
    }

    return realServerId;
  }

  async switchServer(newServerId: string) {
    const oldId = this.activeServerId;

    if (oldId === newServerId) return;

    // Downgrade old active → notify
    if (oldId) {
      const oldConn = this.connections.get(oldId);
      if (oldConn?.mainWs) {
        oldConn.mainWs.disconnect();
        oldConn.mainWs = null;
        await this.openNotifyWs(oldConn).catch(() => {});
      }
    }

    // Upgrade new → main (skip if server has no connection, i.e. offline)
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

  getMainWs(serverId: string): MainWebSocket | null {
    return this.connections.get(serverId)?.mainWs ?? null;
  }

  disconnectFromServer(serverId: string) {
    const conn = this.connections.get(serverId);
    if (!conn) return;
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
      conn.mainWs?.disconnect();
      conn.notifyWs?.disconnect();
    }
    this.connections.clear();
    this.centralWs?.disconnect();
    this.centralWs = null;
    this.centralTrpc = null;
    this.activeServerId = null;
    this.stopAllRetries();
  }

  // Private: open Main WS

  private async openMainWs(conn: ServerConnection) {
    const ws = new MainWebSocket();

    ws.onEvent = (event, data, seq) => this.handleMainEvent(conn.serverId, event, data, seq);
    ws.onDisconnect = (code, reason) => {
      useConnectionStore.getState().setStatus(conn.serverId, 'reconnecting');
      if (ws.isAuthFailure(code)) {
        useConnectionStore.getState().setStatus(conn.serverId, 'disconnected');
        return;
      }
      const reconnect = async () => {
        // Probe with HTTP first to avoid noisy browser WebSocket error logs
        try {
          await fetch(conn.address, { method: 'HEAD' });
        } catch {
          // Server still down — skip WS attempt entirely
          const attempts = this.reconnectAttempts.get(conn.serverId) ?? 0;
          if (attempts >= 3) {
            // Transition to disconnected + 5s HTTP retry
            useConnectionStore.getState().setStatus(conn.serverId, 'disconnected');
            conn.mainWs = null;
            this.reconnectAttempts.delete(conn.serverId);
            this.startServerRetry(conn.address, (realId) => {
              if (this.activeServerId === conn.serverId || this.activeServerId === realId) {
                useUiStore.getState().setActiveServer(realId);
                this.switchServer(realId).catch(() => {});
              }
            });
          } else {
            this.scheduleReconnect(conn.serverId, reconnect);
          }
          return;
        }

        // Server responded to HTTP — try WS reconnect
        try {
          if (!ws.isInvalidSequence(code) && ws.lastSeq > 0) {
            await ws.resume(conn.address, conn.token, ws.lastSeq);
          } else {
            await ws.connect(conn.address, conn.token);
          }
          useConnectionStore.getState().setStatus(conn.serverId, 'connected');
          this.reconnectAttempts.delete(conn.serverId);
        } catch {
          this.scheduleReconnect(conn.serverId, reconnect);
        }
      };
      this.scheduleReconnect(conn.serverId, reconnect);
    };

    try {
      const ready = await ws.connect(conn.address, conn.token);
      conn.mainWs = ws;
      useConnectionStore.getState().setStatus(conn.serverId, 'connected');
      this.reconnectAttempts.delete(conn.serverId);

      // Populate stores from system.ready
      const readyData = ready as unknown as {
        user_id?: string;
        server?: { setup_completed?: boolean; admin_user_id?: string | null };
        channels?: Channel[];
        categories?: Category[];
        members?: Member[];
        roles?: Role[];
        read_states?: ReadState[];
        presences?: { user_id: string; status: PresenceStatus; custom_text?: string }[];
        voice_states?: VoiceState[];
      };

      if (readyData.server) {
        useServerStore.getState().setServerMeta(conn.serverId, {
          setup_completed: readyData.server.setup_completed ?? true,
          admin_user_id: readyData.server.admin_user_id ?? null,
          user_id: readyData.user_id ?? null,
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

      // Auto-subscribe to the active channel if this is the active server
      const { activeServerId, activeChannelId } = useUiStore.getState();
      if (activeChannelId && (activeServerId === conn.serverId || activeServerId === null)) {
        ws.subscribe(activeChannelId);
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
      this.scheduleReconnect(`notify:${conn.serverId}`, () =>
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

  // Event routing

  private handleMainEvent(serverId: string, event: string, data: unknown, _seq: number) {
    const d = data as Record<string, unknown>;

    if (event.startsWith('voice.')) {
      console.log('[ws:client] received event:', event, JSON.stringify(d));
    }

    switch (event) {
      case 'message.create':
        useMessageStore.getState().addMessage(d.channel_id as string, d as unknown as Message);
        useReadStateStore.getState().incrementUnread(d.channel_id as string);
        this.maybeNotify(serverId, d);
        break;

      case 'message.update':
        useMessageStore.getState().updateMessage(d.channel_id as string, {
          id: d.id as string,
          content: d.content as string,
          edited_at: d.edited_at as string,
        });
        break;

      case 'message.delete':
        useMessageStore.getState().deleteMessage(d.channel_id as string, d.id as string);
        break;

      case 'message.reaction_update':
        useMessageStore.getState().updateReaction(
          d.channel_id as string,
          d.message_id as string,
          d.emoji as string,
          d.user_id as string,
          d.action as 'add' | 'remove',
          d.count as number,
        );
        break;

      case 'typing.start':
        useMessageStore.getState().setTyping(d.channel_id as string, d.user_id as string);
        break;

      case 'typing.stop':
        useMessageStore.getState().clearTyping(d.channel_id as string, d.user_id as string);
        break;

      case 'channel.create':
        useChannelStore.getState().addChannel(serverId, d as unknown as Channel);
        break;

      case 'channel.update':
        useChannelStore.getState().updateChannel(serverId, d as unknown as Channel & { id: string });
        break;

      case 'channel.delete':
        useChannelStore.getState().removeChannel(serverId, d.id as string);
        break;

      case 'channel.reorder':
        useChannelStore.getState().setChannels(serverId, d as unknown as Channel[]);
        break;

      case 'category.create':
        useChannelStore.getState().addCategory(serverId, d as unknown as Category);
        break;

      case 'category.update':
        useChannelStore.getState().updateCategory(serverId, d as unknown as Category & { id: string });
        break;

      case 'category.delete':
        useChannelStore.getState().removeCategory(serverId, d.id as string);
        break;

      case 'category.reorder':
        useChannelStore.getState().setCategories(serverId, d as unknown as Category[]);
        break;

      case 'role.create':
        useRoleStore.getState().addRole(serverId, d as unknown as Role);
        break;

      case 'role.update':
        useRoleStore.getState().updateRole(serverId, d.id as string, d as Partial<Role>);
        break;

      case 'role.delete':
        useRoleStore.getState().removeRole(serverId, d.id as string);
        break;

      case 'role.reorder':
        useRoleStore.getState().setRoles(serverId, d as unknown as Role[]);
        break;

      case 'server.update':
        useServerStore.getState().updateServer(serverId, d as Partial<import('ecto-shared').ServerListEntry>);
        break;

      case 'invite.create':
        useServerStore.getState().incrementEventSeq(serverId);
        break;

      case 'invite.delete':
        useServerStore.getState().incrementEventSeq(serverId);
        break;

      case 'member.join':
        useMemberStore.getState().addMember(serverId, d as unknown as Member);
        break;

      case 'member.leave':
        useMemberStore.getState().removeMember(serverId, d.user_id as string);
        break;

      case 'member.update':
        useMemberStore.getState().updateMember(serverId, d.user_id as string, d as Partial<Member>);
        break;

      case 'presence.update':
        usePresenceStore.getState().setPresence(
          d.user_id as string,
          d.status as PresenceStatus,
          d.custom_text as string | undefined,
        );
        break;

      case 'voice.state_update':
        if (d._removed) {
          console.log('[ws:client] removing participant:', d.user_id);
          useVoiceStore.getState().removeParticipant(d.user_id as string);
        } else {
          console.log('[ws:client] adding participant:', d.user_id, 'channel:', d.channel_id);
          useVoiceStore.getState().addParticipant(d as unknown as VoiceState);
          console.log('[ws:client] participants after add:', [...useVoiceStore.getState().participants.keys()]);
        }
        break;

      // Voice signaling events are handled by the voice service
      case 'voice.router_capabilities':
      case 'voice.transport_created':
      case 'voice.produced':
      case 'voice.new_consumer':
      case 'voice.producer_closed':
      case 'voice.server_muted':
      case 'voice.quality_update':
        // These are dispatched to voice event listeners
        break;
    }
  }

  private handleCentralEvent(event: string, data: unknown) {
    const d = data as Record<string, unknown>;

    switch (event) {
      case 'friend.request_incoming':
        useFriendStore.getState().addIncomingRequest(d as unknown as FriendRequest);
        break;

      case 'friend.request_outgoing':
        useFriendStore.getState().addOutgoingRequest(d as unknown as FriendRequest);
        break;

      case 'friend.accept':
        useFriendStore.getState().acceptedRequest(d as unknown as Friend);
        break;

      case 'friend.remove':
        useFriendStore.getState().removeFriend(d.user_id as string);
        break;

      case 'friend.presence':
      case 'friend.online':
        usePresenceStore.getState().setPresence(
          d.user_id as string,
          (d.status as PresenceStatus) ?? 'online',
          d.custom_text as string | undefined,
        );
        break;

      case 'friend.offline':
        usePresenceStore.getState().setPresence(d.user_id as string, 'offline');
        break;

      case 'dm.message': {
        const msg = d as unknown as DirectMessage;
        const myId = useAuthStore.getState().user?.id;
        // Key by the OTHER user (peer), not ourselves
        const peerId = msg.sender_id === myId ? msg.recipient_id : msg.sender_id;
        useDmStore.getState().addMessage(peerId, msg);
        // Ensure sidebar conversation exists/is updated
        useDmStore.getState().ensureConversation(peerId, msg);
        break;
      }

      case 'dm.typing':
        useDmStore.getState().setTyping(d.user_id as string);
        break;

      case 'dm.message_update': {
        const updatedMsg = d as unknown as DirectMessage;
        const myId = useAuthStore.getState().user?.id;
        const peerId = updatedMsg.sender_id === myId ? updatedMsg.recipient_id : updatedMsg.sender_id;
        useDmStore.getState().updateMessage(peerId, updatedMsg.id, updatedMsg);
        break;
      }

      case 'dm.reaction_update': {
        const messageId = d.message_id as string;
        const reactions = d.reactions as import('ecto-shared').ReactionGroup[];
        // Find which peer conversation this message belongs to
        for (const [peerId, msgs] of useDmStore.getState().messages) {
          if (msgs.has(messageId)) {
            useDmStore.getState().updateReactions(peerId, messageId, reactions);
            break;
          }
        }
        break;
      }

      default:
        // Route call.* events to call handler
        if (event.startsWith('call.')) {
          handleCallWsEvent(event, data);
        }
        break;
    }
  }

  private maybeNotify(serverId: string, d: Record<string, unknown>) {
    if (!document.hasFocus() && window.electronAPI) {
      const author = d.author as { username?: string } | undefined;
      const content = d.content as string | undefined;
      window.electronAPI.notifications.showNotification(
        author?.username ?? 'New Message',
        content?.slice(0, 100) ?? '',
        { serverId, channelId: d.channel_id as string },
      );
    }
  }

  // Server auto-retry for disconnected servers

  startServerRetry(
    address: string,
    onReconnected: (realServerId: string) => void,
  ): void {
    if (this.retryTimers.has(address)) return;

    const serverUrl = address.startsWith('http') ? address : `http://${address}`;
    let connecting = false;

    // Use setInterval for flat stack traces (chained setTimeout produces growing async traces)
    const intervalId = setInterval(() => {
      if (connecting) return; // Skip if previous attempt still in progress

      // Use Central token if available, otherwise try stored local token
      const token = useAuthStore.getState().getToken();
      if (!token) {
        // Look for a stored local server token for this address
        const sessions = this.getStoredServerSessions();
        const session = sessions.find((s) => s.address === serverUrl || s.address === address);
        if (session) {
          // Use connectToServerLocal for local-auth reconnection
          connecting = true;
          this.connectToServerLocal(address, session.token).then((realId) => {
            clearInterval(intervalId);
            this.retryTimers.delete(address);
            onReconnected(realId);
          }).catch(() => {
            connecting = false;
          });
          return;
        }
        clearInterval(intervalId);
        this.retryTimers.delete(address);
        return;
      }

      connecting = true;
      // Lightweight probe — connection refused fails instantly, any HTTP response means server is up
      fetch(serverUrl, { method: 'HEAD' }).then(() => {
        // Server responded — stop polling, do full connect
        clearInterval(intervalId);
        this.retryTimers.delete(address);
        return this.connectToServer(address, address, token!, { silent: true });
      }).then((realId) => {
        if (realId) onReconnected(realId);
      }).catch(() => {
        // Still down or connect failed — interval will fire again
        connecting = false;
      });
    }, 5000);

    this.retryTimers.set(address, intervalId);
  }

  stopServerRetry(address: string): void {
    const timer = this.retryTimers.get(address);
    if (timer) {
      clearInterval(timer);
      this.retryTimers.delete(address);
    }
  }

  private stopAllRetries(): void {
    for (const timer of this.retryTimers.values()) {
      clearInterval(timer);
    }
    this.retryTimers.clear();
  }

  // Reconnection

  private scheduleReconnect(key: string, reconnectFn: () => Promise<void>) {
    const attempts = this.reconnectAttempts.get(key) ?? 0;
    const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
    this.reconnectAttempts.set(key, attempts + 1);
    setTimeout(() => reconnectFn(), delay);
  }
}

export const connectionManager = new ConnectionManager();
