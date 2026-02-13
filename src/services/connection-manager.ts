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

  getCentralTrpc(): CentralTrpcClient | null {
    return this.centralTrpc;
  }

  getCentralWs(): CentralWebSocket | null {
    return this.centralWs;
  }

  // Server connections

  async connectToServer(serverId: string, address: string, token: string) {
    useConnectionStore.getState().setStatus(serverId, 'connecting');

    // Always call server.join to get the real server UUID and a server token.
    // This is idempotent — existing members get a fresh token.
    const serverUrl = address.startsWith('http') ? address : `http://${address}`;
    let realServerId = serverId;
    let serverToken = token;
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
      }
    } catch {
      // Fall through — try connecting with what we have
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

    // Upgrade new → main
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
      this.scheduleReconnect(conn.serverId, async () => {
        try {
          if (!ws.isInvalidSequence(code) && ws.lastSeq > 0) {
            await ws.resume(conn.address, conn.token, ws.lastSeq);
          } else {
            await ws.connect(conn.address, conn.token);
          }
          useConnectionStore.getState().setStatus(conn.serverId, 'connected');
          this.reconnectAttempts.delete(conn.serverId);
        } catch {
          // scheduleReconnect will retry
        }
      });
    };

    try {
      const ready = await ws.connect(conn.address, conn.token);
      conn.mainWs = ws;
      useConnectionStore.getState().setStatus(conn.serverId, 'connected');
      this.reconnectAttempts.delete(conn.serverId);

      // Populate stores from system.ready
      const readyData = ready as unknown as {
        channels?: Channel[];
        categories?: Category[];
        members?: Member[];
        roles?: Role[];
        read_states?: ReadState[];
        presences?: { user_id: string; status: PresenceStatus; custom_text?: string }[];
        voice_states?: VoiceState[];
      };

      if (readyData.channels) {
        useChannelStore.getState().setChannels(conn.serverId, readyData.channels);
      }
      if (readyData.categories) {
        useChannelStore.getState().setCategories(conn.serverId, readyData.categories);
      }
      if (readyData.members) {
        useMemberStore.getState().setMembers(conn.serverId, readyData.members);
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

  // Reconnection

  private scheduleReconnect(key: string, reconnectFn: () => Promise<void>) {
    const attempts = this.reconnectAttempts.get(key) ?? 0;
    const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
    this.reconnectAttempts.set(key, attempts + 1);
    setTimeout(() => reconnectFn(), delay);
  }
}

export const connectionManager = new ConnectionManager();
