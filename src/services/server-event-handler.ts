import type { Channel, Category, Member, Role, VoiceState, PresenceStatus, Message, PageContent, SharedFile, SharedFolder } from 'ecto-shared';
import { useChannelStore } from '../stores/channel.js';
import { useMemberStore } from '../stores/member.js';
import { usePresenceStore } from '../stores/presence.js';
import { useMessageStore } from '../stores/message.js';
import { useReadStateStore } from '../stores/read-state.js';
import { useVoiceStore } from '../stores/voice.js';
import { useNotifyStore } from '../stores/notify.js';
import { useAuthStore } from '../stores/auth.js';
import { useServerStore } from '../stores/server.js';
import { useRoleStore } from '../stores/role.js';
import { useToastStore } from '../stores/toast.js';
import { useUiStore } from '../stores/ui.js';
import { playNotificationSound } from '../lib/notification-sounds.js';
import { showOsNotification, shouldNotifyEveryone } from './notification-service.js';
import { connectionManager } from './connection-manager.js';
import { pageEventListeners } from '../hooks/usePage.js';
import { useHubFilesStore } from '../stores/hub-files.js';
import { useServerDmStore } from '../stores/server-dm.js';
import { useActivityStore } from '../stores/activity.js';

export function handleMainEvent(serverId: string, event: string, data: unknown, _seq: number) {
  const d = data as Record<string, unknown>;

  switch (event) {
    case 'message.create':
      useMessageStore.getState().addMessage(d.channel_id as string, d as unknown as Message);
      useReadStateStore.getState().incrementUnread(d.channel_id as string);
      maybeNotify(serverId, d);
      break;

    case 'mention.create': {
      useReadStateStore.getState().incrementMention(d.channel_id as string);
      useNotifyStore.getState().addNotification(serverId, d.channel_id as string, Date.now(), 'mention');
      playNotificationSound('mention');
      const mentionAuthor = useMemberStore.getState().members.get(serverId)?.get(d.author_id as string);
      const mentionAuthorName = mentionAuthor?.display_name ?? mentionAuthor?.username ?? 'Someone';
      useToastStore.getState().addToast({
        serverId,
        channelId: d.channel_id as string,
        authorName: mentionAuthorName,
        avatarUrl: mentionAuthor?.avatar_url ?? undefined,
        content: ((d.content as string) ?? '').slice(0, 200),
      });
      break;
    }

    case 'message.update':
      useMessageStore.getState().updateMessage(d.channel_id as string, {
        id: d.id as string,
        content: d.content as string,
        edited_at: d.edited_at as string,
        pinned: d.pinned as boolean,
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
      // Keep serverMeta in sync with server updates
      {
        const meta = useServerStore.getState().serverMeta.get(serverId);
        if (meta) {
          const metaUpdates: Partial<typeof meta> = {};
          if (d.admin_user_id !== undefined) metaUpdates.admin_user_id = d.admin_user_id as string;
          if (d.banner_url !== undefined) metaUpdates.banner_url = d.banner_url as string | null;
          if (d.allow_member_dms !== undefined) metaUpdates.allow_member_dms = d.allow_member_dms as boolean;
          if (Object.keys(metaUpdates).length > 0) {
            useServerStore.getState().setServerMeta(serverId, { ...meta, ...metaUpdates });
          }
        }
      }
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
        useVoiceStore.getState().removeParticipant(d.user_id as string);
      } else {
        useVoiceStore.getState().addParticipant(d as unknown as VoiceState);
      }
      break;

    case 'permissions.update':
      handlePermissionsUpdate(serverId);
      break;

    case 'page.update':
      for (const listener of pageEventListeners) {
        listener(d as unknown as PageContent);
      }
      break;

    // Hub file events
    case 'shared_file.create':
      useHubFilesStore.getState().addSharedFile(d as unknown as SharedFile);
      break;
    case 'shared_file.delete':
      useHubFilesStore.getState().removeSharedFile(d.id as string);
      break;
    case 'shared_folder.create':
      useHubFilesStore.getState().addSharedFolder(d as unknown as SharedFolder);
      break;
    case 'shared_folder.delete':
      useHubFilesStore.getState().removeSharedFolder(d.id as string);
      break;
    case 'channel_file.delete':
      useHubFilesStore.getState().removeChannelFile(d.id as string);
      break;
    case 'shared_item.permissions_update':
      // Reload shared folder/file listings to reflect permission changes
      useHubFilesStore.getState().requestReload();
      break;

    // Server DM events
    case 'server_dm.message': {
      const convoId = d.conversation_id as string;
      useServerDmStore.getState().addMessage(convoId, d as unknown as import('ecto-shared').ServerDmMessage);
      // If this is a new conversation, ensure it exists in the list
      if (!useServerDmStore.getState().conversations.has(convoId)) {
        const peerId = d._conversation_peer_id as string | undefined;
        if (peerId) {
          const author = d.author as { id: string; username: string; display_name: string | null; avatar_url: string | null; nickname: string | null };
          const peerIsAuthor = author.id === peerId;
          let peerData: { user_id: string; username: string; display_name: string | null; avatar_url: string | null; nickname: string | null };
          if (peerIsAuthor) {
            peerData = { user_id: peerId, username: author.username, display_name: author.display_name, avatar_url: author.avatar_url, nickname: author.nickname };
          } else {
            // Peer is not the author (we sent the message) — look up from member store
            const peerMember = useMemberStore.getState().members.get(serverId)?.get(peerId);
            peerData = {
              user_id: peerId,
              username: peerMember?.username ?? 'Unknown',
              display_name: peerMember?.display_name ?? null,
              avatar_url: peerMember?.avatar_url ?? null,
              nickname: peerMember?.nickname ?? null,
            };
          }
          useServerDmStore.getState().ensureConversation({
            id: convoId,
            peer: peerData,
            last_message: d as unknown as import('ecto-shared').ServerDmMessage,
            unread_count: 0,
          });
        }
      }
      // Track unreads and play notification sound if not our own message
      const myId = useAuthStore.getState().user?.id;
      const authorId = (d.author as { id?: string } | undefined)?.id;
      if (authorId && authorId !== myId) {
        // Increment unread unless the user is actively viewing this conversation
        const dmStore = useServerDmStore.getState();
        const isViewingThisConvo =
          dmStore.activeConversationId === convoId &&
          useUiStore.getState().hubSection === 'server-dms' &&
          useUiStore.getState().activeServerId === serverId;
        if (!isViewingThisConvo) {
          useServerDmStore.getState().incrementUnread(serverId, convoId);
        }
        playNotificationSound('message');
      }
      break;
    }

    case 'server_dm.update':
      useServerDmStore.getState().updateMessage(
        d.conversation_id as string,
        d.id as string,
        d as unknown as Partial<import('ecto-shared').ServerDmMessage>,
      );
      break;

    case 'server_dm.delete':
      useServerDmStore.getState().deleteMessage(d.conversation_id as string, d.id as string);
      break;

    case 'server_dm.reaction_update':
      useServerDmStore.getState().updateReaction(
        d.conversation_id as string,
        d.message_id as string,
        d.emoji as string,
        d.user_id as string,
        d.action as 'add' | 'remove',
        d.count as number,
      );
      break;

    case 'server_dm.typing':
      useServerDmStore.getState().setTyping(d.conversation_id as string);
      break;

    // Server deletion
    case 'server.delete':
      // Server was deleted — disconnect and clean up
      connectionManager.disconnectFromServer(serverId);
      useServerStore.getState().removeServer(serverId);
      if (useUiStore.getState().activeServerId === serverId) {
        useUiStore.getState().setActiveServer(null);
      }
      break;

    // Shared folder update
    case 'shared_folder.update':
      useHubFilesStore.getState().updateSharedFolder(d.id as string, d as Partial<SharedFolder>);
      break;

    case 'activity.create': {
      const item = d as unknown as import('ecto-shared').ActivityItem;
      // Tag with server_name from store if missing
      if (!item.source.server_name) {
        const server = useServerStore.getState().servers.get(serverId);
        if (server?.server_name) {
          item.source.server_name = server.server_name;
        }
      }
      useActivityStore.getState().addItem(item);
      break;
    }

    // Voice signaling events are handled by the voice service
    case 'voice.router_capabilities':
    case 'voice.transport_created':
    case 'voice.produced':
    case 'voice.new_consumer':
    case 'voice.producer_closed':
    case 'voice.server_muted':
    case 'voice.quality_update':
    case 'voice.already_connected':
    case 'voice.transferred':
    case 'voice.error':
      // These are dispatched to voice event listeners
      break;

    default:
      if (import.meta.env.DEV) {
        console.debug(`[ws] Unhandled server event: ${event}`, data);
      }
      break;
  }
}

async function handlePermissionsUpdate(serverId: string) {
  const trpc = connectionManager.getServerTrpc(serverId);
  if (!trpc) return;

  try {
    const result = await trpc.channels.list.query();

    // Flatten all channels from the response
    const newChannels = new Map<string, Channel>();
    for (const ch of result.uncategorized as Channel[]) {
      newChannels.set(ch.id, ch);
    }
    for (const cat of result.categories as Array<Category & { channels: Channel[] }>) {
      for (const ch of cat.channels) {
        newChannels.set(ch.id, ch);
      }
    }

    // Flatten categories
    const newCategories = new Map<string, Category>();
    for (const cat of result.categories as Array<Category & { channels: Channel[] }>) {
      const { channels: _, ...categoryOnly } = cat;
      newCategories.set(cat.id, categoryOnly as Category);
    }

    // Diff channels
    const currentChannels = useChannelStore.getState().channels.get(serverId) ?? new Map<string, Channel>();
    for (const [id] of currentChannels) {
      if (!newChannels.has(id)) {
        useChannelStore.getState().removeChannel(serverId, id);
      }
    }
    for (const [id, ch] of newChannels) {
      if (!currentChannels.has(id)) {
        useChannelStore.getState().addChannel(serverId, ch);
      } else {
        useChannelStore.getState().updateChannel(serverId, ch as Channel & { id: string });
      }
    }

    // Diff categories
    const currentCategories = useChannelStore.getState().categories.get(serverId) ?? new Map<string, Category>();
    for (const [id] of currentCategories) {
      if (!newCategories.has(id)) {
        useChannelStore.getState().removeCategory(serverId, id);
      }
    }
    for (const [id, cat] of newCategories) {
      if (!currentCategories.has(id)) {
        useChannelStore.getState().addCategory(serverId, cat);
      } else {
        useChannelStore.getState().updateCategory(serverId, cat as Category & { id: string });
      }
    }

    // If active channel was removed, show lock screen
    const activeChannelId = useUiStore.getState().activeChannelId;
    if (activeChannelId && !newChannels.has(activeChannelId) && useUiStore.getState().activeServerId === serverId) {
      useUiStore.getState().setChannelLocked(true);
    }
  } catch {
    // Silently ignore — server may be unreachable
  }
}

function maybeNotify(serverId: string, d: Record<string, unknown>) {
  const myId = useAuthStore.getState().user?.id;
  const authorId = (d.author as { id?: string } | undefined)?.id;
  if (authorId === myId) return;

  // Sound for non-mention messages (mention sound is played by mention.create handler)
  const mentions = d.mentions as string[] | undefined;
  const mentionEveryone = d.mention_everyone as boolean | undefined;
  const isMention = (mentions?.includes(myId ?? '') ?? false) || mentionEveryone;
  if (!isMention) {
    playNotificationSound('message');
  }

  // OS notification for @everyone messages (gated by pref) and regular messages
  if (isMention && mentionEveryone) {
    if (shouldNotifyEveryone()) {
      const author = d.author as { username?: string } | undefined;
      showOsNotification(
        author?.username ?? 'New Message',
        (d.content as string | undefined)?.slice(0, 100) ?? '',
        { type: 'everyone', serverId, channelId: d.channel_id as string },
      );
    }
  } else if (!isMention) {
    const author = d.author as { username?: string } | undefined;
    showOsNotification(
      author?.username ?? 'New Message',
      (d.content as string | undefined)?.slice(0, 100) ?? '',
      { type: 'message', serverId, channelId: d.channel_id as string },
    );
  }
}
