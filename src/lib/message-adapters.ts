import type { DirectMessage, ServerDmMessage, Message } from 'ecto-shared';

/** Adapt a DirectMessage to the Message shape used by MessageList/MessageItem. */
export function dmToMessage(dm: DirectMessage): Message {
  return {
    id: dm.id,
    channel_id: '',
    author: dm.sender,
    content: dm.content,
    type: 0,
    reply_to: dm.reply_to ?? null,
    pinned: dm.pinned ?? false,
    mention_everyone: false,
    mention_roles: [],
    mentions: [],
    edited_at: dm.edited_at,
    created_at: dm.created_at,
    attachments: dm.attachments ?? [],
    reactions: dm.reactions ?? [],
    webhook_id: null,
  };
}

/** Adapt a ServerDmMessage to the Message shape used by MessageList/MessageItem. */
export function serverDmToMessage(dm: ServerDmMessage): Message {
  return {
    id: dm.id,
    channel_id: dm.conversation_id,
    author: dm.author,
    content: dm.content,
    type: 0,
    reply_to: dm.reply_to ?? null,
    pinned: false,
    mention_everyone: false,
    mention_roles: [],
    mentions: [],
    edited_at: dm.edited_at,
    created_at: dm.created_at,
    attachments: dm.attachments ?? [],
    reactions: dm.reactions ?? [],
    webhook_id: null,
  };
}
