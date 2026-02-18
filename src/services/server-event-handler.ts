import type { Channel, Category, Member, Role, VoiceState, PresenceStatus, Message } from 'ecto-shared';
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
import { playNotificationSound } from '../lib/notification-sounds.js';
import { showOsNotification, shouldNotifyEveryone } from './notification-service.js';

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
