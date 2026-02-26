import { useState, useMemo, memo } from 'react';

import { Reply, Copy, Pin, PinOff, Pencil, Trash2 } from 'lucide-react';
import { Avatar } from '@/ui';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/ui/ContextMenu';

import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { useMemberStore } from '@/stores/member';
import { useChannelStore } from '@/stores/channel';
import { useRoleStore } from '@/stores/role';
import { usePermissions } from '@/hooks/usePermissions';

import { renderMarkdown } from '@/lib/markdown';
import { extractServerAddresses } from '@/lib/server-address';

import { MessageType, Permissions } from 'ecto-shared';
import type { Message } from 'ecto-shared';

import { MessageHeader } from './MessageHeader';
import { ReplyReference } from './ReplyReference';
import { MessageEditForm } from './MessageEditForm';
import { MessageAttachments } from './MessageAttachments';
import { MessageReactions } from './MessageReactions';
import { MessageToolbar } from './MessageToolbar';
import { LinkPreviews } from './LinkPreview';
import { ServerLinkEmbeds } from './ServerLinkEmbed';

type MessageItemProps = {
  message: Message;
  onEdit: (messageId: string, content: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  onReact: (messageId: string, emoji: string) => Promise<void>;
  onPin: (messageId: string) => Promise<void>;
  readOnly?: boolean;
  reactOnly?: boolean;
  /** Whether this message is grouped with the previous (same author, consecutive). Hides avatar/header. */
  grouped?: boolean;
  onJumpToMessage?: (messageId: string) => void;
  onReply?: () => void;
};

export const MessageItem = memo(function MessageItem({
  message, onEdit, onDelete, onReact, onPin, readOnly, reactOnly, grouped, onJumpToMessage, onReply,
}: MessageItemProps) {
  const [editing, setEditing] = useState(false);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const activeServerId = useUiStore((s) => s.activeServerId);
  const isOwn = message.author?.id === currentUserId;
  const { effectivePermissions, isAdmin } = usePermissions(activeServerId);
  const canManageMessages = isAdmin || (effectivePermissions & Permissions.MANAGE_MESSAGES) !== 0;
  const canDelete = isOwn || canManageMessages;
  const serverMembers = useMemberStore((s) => activeServerId ? s.members.get(activeServerId) : undefined);
  const serverChannels = useChannelStore((s) => activeServerId ? s.channels.get(activeServerId) : undefined);
  const serverRoles = useRoleStore((s) => activeServerId ? s.roles.get(activeServerId) : undefined);

  const mentionResolver = useMemo(() => {
    const members = new Map<string, string>();
    if (serverMembers) {
      for (const [userId, m] of serverMembers) {
        members.set(userId, m.nickname ?? m.display_name ?? m.username);
      }
    }
    const channels = new Map<string, string>();
    if (serverChannels) {
      for (const [channelId, ch] of serverChannels) {
        channels.set(channelId, ch.name);
      }
    }
    const roles = new Map<string, { name: string; color: string | null }>();
    if (serverRoles) {
      for (const [roleId, r] of serverRoles) {
        roles.set(roleId, { name: r.name, color: r.color });
      }
    }
    return { members, channels, roles, mentionEveryone: message.mention_everyone };
  }, [serverMembers, serverChannels, serverRoles, message.mention_everyone]);

  const ectoAddresses = useMemo(
    () => (message.content ? extractServerAddresses(message.content) : []),
    [message.content],
  );

  const handleAuthorClick = () => {
    if (!message.author?.id) return;
    useUiStore.getState().openModal('user-profile', { userId: message.author.id, serverId: activeServerId ?? undefined });
  };

  const timestamp = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  // System message rendering
  if (message.type !== undefined && message.type !== 0) {
    const actor = message.author?.display_name ?? message.author?.username ?? 'Someone';

    const fullTimestamp = new Date(message.created_at).toLocaleString([], {
      month: 'numeric', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    if (message.type === MessageType.PIN_ADDED) {
      return (
        <div className="flex gap-3 py-2 px-4 items-center">
          <div className="w-[40px] shrink-0 flex items-center justify-center">
            <span className="text-lg text-accent">📌</span>
          </div>
          <span className="text-sm">
            <button type="button" className="font-semibold text-primary hover:underline cursor-pointer" onClick={handleAuthorClick}>{actor}</button>{' '}
            <button
              type="button"
              className="text-accent hover:underline cursor-pointer"
              onClick={() => message.reply_to && onJumpToMessage?.(message.reply_to)}
            >
              pinned a message
            </button>
          </span>
          <span className="text-xs text-muted">{fullTimestamp}</span>
        </div>
      );
    }

    if (message.type === MessageType.MEMBER_JOIN) {
      const phrases = [
        'just showed up!', 'hopped into the server.', 'just landed.',
        'joined the party.', 'is here.', 'just arrived.',
        'just slid in.', 'appeared.', 'has entered the chat.', 'just joined.',
      ];
      let hash = 0;
      for (let i = 0; i < message.id.length; i++) hash += message.id.charCodeAt(i);
      const phrase = phrases[hash % phrases.length];
      return (
        <div className="flex gap-3 py-2 px-4 items-center">
          <div className="w-[40px] shrink-0 flex items-center justify-center">
            <span className="text-lg text-success">→</span>
          </div>
          <span className="text-sm">
            <button type="button" className="font-semibold text-primary hover:underline cursor-pointer" onClick={handleAuthorClick}>{actor}</button>{' '}
            <span className="text-muted">{phrase}</span>
          </span>
          <span className="text-xs text-muted">{fullTimestamp}</span>
        </div>
      );
    }

    let systemText = message.content ?? '';
    if (!systemText) {
      switch (message.type) {
        case MessageType.MEMBER_LEAVE: systemText = `${actor} left the server`; break;
        case MessageType.CHANNEL_NAME_CHANGE: systemText = `${actor} changed the channel name`; break;
        default: systemText = 'System message';
      }
    }
    return (
      <div className="flex gap-3 py-1 px-4 items-center">
        <div className="w-[40px] shrink-0" />
        <span className="text-sm text-muted italic">{systemText}</span>
        <span className="text-xs text-muted">{timestamp}</span>
      </div>
    );
  }

  const authorName = message.author?.display_name ?? message.author?.username ?? 'Unknown';

  if (readOnly) {
    return (
      <div className="relative flex gap-3 py-1 px-4 group hover:bg-[rgba(30,42,74,0.5)]">
        {grouped ? (
          <div className="w-[40px] shrink-0" />
        ) : (
          <div onClick={handleAuthorClick} className="shrink-0 cursor-pointer">
            <Avatar src={message.author?.avatar_url} username={message.author?.username ?? 'Unknown'} size={40} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {!grouped && (
            <MessageHeader authorName={authorName} isBot={!!message.webhook_id} timestamp={timestamp} isEdited={!!message.edited_at} isPinned={message.pinned} onAuthorClick={handleAuthorClick} />
          )}
          {message.reply_to && <ReplyReference replyTo={message.reply_to} onJump={onJumpToMessage} />}
          {editing ? (
            <MessageEditForm initialContent={message.content ?? ''} onSave={(content) => { onEdit(message.id, content); setEditing(false); }} onCancel={() => setEditing(false)} />
          ) : (
            <>
              <div className="text-base font-normal text-primary message-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content ?? '', mentionResolver) }} onClick={(e) => { const el = e.target as HTMLElement; if (el.classList.contains('spoiler')) el.classList.toggle('revealed'); if (el.classList.contains('mention') && el.dataset.type === 'user' && el.dataset.id) { useUiStore.getState().openModal('user-profile', { userId: el.dataset.id, serverId: activeServerId ?? undefined }); } if (el.classList.contains('inline-image') && el instanceof HTMLImageElement) { useUiStore.getState().openModal('image-lightbox', { src: el.src, alt: el.alt }); } }} />
              {message.content && ectoAddresses.length > 0 && <ServerLinkEmbeds content={message.content} />}
              {message.content && <LinkPreviews content={message.content} excludeUrls={ectoAddresses} />}
            </>
          )}
          <MessageAttachments attachments={message.attachments ?? []} />
          <MessageReactions reactions={message.reactions ?? []} onReact={(emoji) => onReact(message.id, emoji)} />
        </div>
      </div>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className="relative flex gap-3 py-1 px-4 group hover:bg-[rgba(30,42,74,0.5)]"
        >
          {grouped ? (
            <div className="w-[40px] shrink-0" />
          ) : (
            <div onClick={handleAuthorClick} className="shrink-0 cursor-pointer">
              <Avatar src={message.author?.avatar_url} username={message.author?.username ?? 'Unknown'} size={40} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            {!grouped && (
              <MessageHeader
                authorName={authorName}
                isBot={!!message.webhook_id}
                timestamp={timestamp}
                isEdited={!!message.edited_at}
                isPinned={message.pinned}
                onAuthorClick={handleAuthorClick}
              />
            )}
            {message.reply_to && <ReplyReference replyTo={message.reply_to} onJump={onJumpToMessage} />}
            {editing ? (
              <MessageEditForm
                initialContent={message.content ?? ''}
                onSave={(content) => { onEdit(message.id, content); setEditing(false); }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <>
                <div
                  className="text-base font-normal text-primary message-markdown"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content ?? '', mentionResolver) }}
                  onClick={(e) => {
                    const el = e.target as HTMLElement;
                    if (el.classList.contains('spoiler')) el.classList.toggle('revealed');
                    if (el.classList.contains('mention') && el.dataset.type === 'user' && el.dataset.id) {
                      useUiStore.getState().openModal('user-profile', { userId: el.dataset.id, serverId: activeServerId ?? undefined });
                    }
                    if (el.classList.contains('inline-image') && el instanceof HTMLImageElement) {
                      useUiStore.getState().openModal('image-lightbox', { src: el.src, alt: el.alt });
                    }
                  }}
                />
                {message.content && ectoAddresses.length > 0 && <ServerLinkEmbeds content={message.content} />}
                {message.content && <LinkPreviews content={message.content} excludeUrls={ectoAddresses} />}
              </>
            )}
            <MessageAttachments attachments={message.attachments ?? []} />
            <MessageReactions reactions={message.reactions ?? []} onReact={(emoji) => onReact(message.id, emoji)} />
          </div>

          {!editing && (
            <MessageToolbar
              isPinned={message.pinned}
              isOwn={isOwn}
              canDelete={canDelete}
              reactOnly={reactOnly}
              onReact={(emoji) => onReact(message.id, emoji)}
              onReply={onReply}
              onPin={() => onPin(message.id)}
              onEdit={() => setEditing(true)}
              onDelete={() => onDelete(message.id)}
            />
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => onReply?.()}>
          <Reply size={14} className="mr-2" />
          Reply
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => navigator.clipboard.writeText(message.content ?? '')}>
          <Copy size={14} className="mr-2" />
          Copy Text
        </ContextMenuItem>
        {!reactOnly && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => onPin(message.id)}>
              {message.pinned ? <PinOff size={14} className="mr-2" /> : <Pin size={14} className="mr-2" />}
              {message.pinned ? 'Unpin' : 'Pin'}
            </ContextMenuItem>
          </>
        )}
        {(isOwn || canDelete) && (
          <>
            <ContextMenuSeparator />
            {isOwn && (
              <ContextMenuItem onSelect={() => setEditing(true)}>
                <Pencil size={14} className="mr-2" />
                Edit
              </ContextMenuItem>
            )}
            <ContextMenuItem danger onSelect={() => onDelete(message.id)}>
              <Trash2 size={14} className="mr-2" />
              Delete
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
});
