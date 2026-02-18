import { useState, useCallback } from 'react';

import { Phone, Video, MessageCircle, UserX, UserPlus, Ban, Check, X } from 'lucide-react';

import { Button } from '@/ui';

import { useFriendStore } from '@/stores/friend';

import { connectionManager } from '@/services/connection-manager';

import type { FriendRequest } from 'ecto-shared';

type UserProfileActionsProps = {
  userId: string;
  username?: string;
  discriminator?: string;
  avatarUrl?: string | null;
  isFriend: boolean;
  isBlocked: boolean;
  incomingRequest?: FriendRequest;
  outgoingRequest?: FriendRequest;
  isInCall: boolean;
  onClose: () => void;
  onSendMessage: () => void;
  onStartCall: (userId: string, mediaTypes: ('audio' | 'video')[]) => void;
};

function getCentralTrpc() {
  const trpc = connectionManager.getCentralTrpc();
  if (!trpc) throw new Error('Not connected to central');
  return trpc;
}

export function UserProfileActions({
  userId, username, discriminator, avatarUrl,
  isFriend, isBlocked, incomingRequest, outgoingRequest, isInCall,
  onClose, onSendMessage, onStartCall,
}: UserProfileActionsProps) {
  const [requestSent, setRequestSent] = useState(false);
  const [error, setError] = useState('');

  const run = useCallback(async (fn: () => Promise<void>, fallback: string) => {
    setError('');
    try { await fn(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : fallback); }
  }, []);

  const sendFriendRequest = () => run(async () => {
    if (!username || !discriminator) return;
    const result = await getCentralTrpc().friends.request.mutate({ username, discriminator });
    useFriendStore.getState().addOutgoingRequest({
      ...result, from: userId,
      from_username: username, from_discriminator: discriminator ?? '',
      from_avatar_url: avatarUrl ?? null,
    });
    setRequestSent(true);
  }, 'Failed to send request');

  const removeFriend = () => run(async () => {
    await getCentralTrpc().friends.remove.mutate({ user_id: userId });
    useFriendStore.getState().removeFriend(userId);
  }, 'Failed to remove friend');

  const accept = () => run(async () => {
    if (!incomingRequest) return;
    await getCentralTrpc().friends.accept.mutate({ friendship_id: incomingRequest.id });
    useFriendStore.getState().removeRequest(incomingRequest.id);
  }, 'Failed to accept request');

  const decline = () => run(async () => {
    if (!incomingRequest) return;
    await getCentralTrpc().friends.decline.mutate({ friendship_id: incomingRequest.id });
    useFriendStore.getState().removeRequest(incomingRequest.id);
  }, 'Failed to decline request');

  const block = () => run(async () => {
    await getCentralTrpc().friends.block.mutate({ user_id: userId });
    useFriendStore.getState().blockUser(userId);
  }, 'Failed to block user');

  const unblock = () => run(async () => {
    await getCentralTrpc().friends.unblock.mutate({ user_id: userId });
    useFriendStore.getState().unblockUser(userId);
  }, 'Failed to unblock user');

  return (
    <div className="-mx-5 -mb-5 flex flex-col gap-2 px-5 pb-5">
      {error && <p className="text-sm text-danger">{error}</p>}

      {isFriend && (
        <>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" className="flex-1"
              onClick={() => { onClose(); onStartCall(userId, ['audio']); }} disabled={isInCall}>
              <Phone size={14} /> Call
            </Button>
            <Button variant="primary" size="sm" className="flex-1"
              onClick={() => { onClose(); onStartCall(userId, ['audio', 'video']); }} disabled={isInCall}>
              <Video size={14} /> Video
            </Button>
          </div>
          <Button variant="secondary" size="sm" onClick={onSendMessage}>
            <MessageCircle size={14} /> Send Message
          </Button>
          <Button variant="danger" size="sm" onClick={removeFriend}>
            <UserX size={14} /> Remove Friend
          </Button>
        </>
      )}

      {incomingRequest && !isFriend && !isBlocked && (
        <div className="flex gap-2">
          <Button variant="primary" size="sm" className="flex-1" onClick={accept}>
            <Check size={14} /> Accept
          </Button>
          <Button variant="secondary" size="sm" className="flex-1" onClick={decline}>
            <X size={14} /> Decline
          </Button>
        </div>
      )}

      {isBlocked && (
        <Button variant="secondary" size="sm" onClick={unblock}>
          <Ban size={14} /> Unblock
        </Button>
      )}

      {!isFriend && !incomingRequest && !isBlocked && (
        <>
          {requestSent || outgoingRequest ? (
            <Button variant="primary" size="sm" disabled>
              <UserPlus size={14} /> Request Sent
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={sendFriendRequest}>
              <UserPlus size={14} /> Add Friend
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={block}>
            <Ban size={14} /> Block
          </Button>
        </>
      )}
    </div>
  );
}
