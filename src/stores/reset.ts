/**
 * Full session teardown — clears all active connections, media resources,
 * and Zustand stores. Must be called on every sign-out / account-deletion
 * path to prevent state leaking between accounts.
 */
import { connectionManager } from '../services/connection-manager.js';
import { useAuthStore } from './auth.js';
import { useServerStore } from './server.js';
import { useChannelStore } from './channel.js';
import { useMemberStore } from './member.js';
import { useMessageStore } from './message.js';
import { useRoleStore } from './role.js';
import { useConnectionStore } from './connection.js';
import { useFriendStore } from './friend.js';
import { useDmStore } from './dm.js';
import { usePresenceStore } from './presence.js';
import { useReadStateStore } from './read-state.js';
import { useNotifyStore } from './notify.js';
import { useVoiceStore } from './voice.js';
import { useCallStore } from './call.js';
import { useUiStore } from './ui.js';
import { useHubFilesStore } from './hub-files.js';

export async function fullLogout() {
  // 1. Stop media resources (voice transports, producers, consumers, mic/camera)
  useVoiceStore.getState().cleanup();
  useCallStore.getState().cleanup();

  // 2. Tear down ALL WebSocket connections and tRPC clients
  connectionManager.disconnectAll();

  // 3. Sign out (invalidate refresh token, clear stored tokens, reset auth state)
  await useAuthStore.getState().logout();

  // 4. Reset every Zustand store to initial state
  useServerStore.setState({
    servers: new Map(),
    serverOrder: [],
    serverMeta: new Map(),
    eventSeq: new Map(),
  });

  useChannelStore.setState({
    channels: new Map(),
    channelOrder: new Map(),
    categories: new Map(),
  });

  useMemberStore.setState({
    members: new Map(),
  });

  useMessageStore.setState({
    messages: new Map(),
    messageOrder: new Map(),
    oldestLoaded: new Map(),
    hasMore: new Map(),
    typingUsers: new Map(),
  });

  useRoleStore.setState({
    roles: new Map(),
  });

  useConnectionStore.setState({
    connections: new Map(),
  });

  useFriendStore.setState({
    friends: new Map(),
    pendingIncoming: new Map(),
    pendingOutgoing: new Map(),
    blocked: new Set(),
  });

  useDmStore.setState({
    conversations: new Map(),
    messages: new Map(),
    messageOrder: new Map(),
    openConversationId: null,
    typingUsers: new Map(),
  });

  usePresenceStore.setState({
    presences: new Map(),
  });

  useReadStateStore.setState({
    lastRead: new Map(),
    unreadCounts: new Map(),
    mentionCounts: new Map(),
  });

  useNotifyStore.setState({
    notifications: new Map(),
  });

  useHubFilesStore.getState().clear();

  // 5. Reset navigation state (preserve user preferences: theme, customCSS, sidebar, memberList)
  useUiStore.setState({
    activeServerId: null,
    activeChannelId: null,
    activeModal: null,
    modalData: null,
    hubSection: null,
  });
}
