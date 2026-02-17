import type { Friend, FriendRequest, PresenceStatus, DirectMessage } from 'ecto-shared';
import { useFriendStore } from '../stores/friend.js';
import { usePresenceStore } from '../stores/presence.js';
import { useDmStore } from '../stores/dm.js';
import { useAuthStore } from '../stores/auth.js';
import { handleCallWsEvent } from '../hooks/useCall.js';
import { playNotificationSound } from '../lib/notification-sounds.js';

export function handleCentralEvent(event: string, data: unknown) {
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
      // Play DM notification sound for incoming messages
      if (msg.sender_id !== myId) {
        playNotificationSound('dm');
      }
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

    case 'dm.message_deleted': {
      const peerId = d.peer_id as string;
      const messageId = d.message_id as string;
      useDmStore.getState().deleteMessage(peerId, messageId);
      break;
    }

    case 'dm.pinUpdate': {
      const messageId = d.message_id as string;
      const pinned = d.pinned as boolean;
      const pinnedAt = (d.pinned_at as string) ?? null;
      // Find which peer conversation this message belongs to
      for (const [peerId, msgs] of useDmStore.getState().messages) {
        if (msgs.has(messageId)) {
          useDmStore.getState().updateMessage(peerId, messageId, {
            pinned,
            pinned_at: pinnedAt,
          });
          break;
        }
      }
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
