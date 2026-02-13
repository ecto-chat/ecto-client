import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../common/Modal.js';
import { Avatar } from '../common/Avatar.js';
import { useUiStore } from '../../stores/ui.js';
import { useAuthStore } from '../../stores/auth.js';
import { useMemberStore } from '../../stores/member.js';
import { useFriendStore } from '../../stores/friend.js';
import { usePresence } from '../../hooks/usePresence.js';
import { useCall } from '../../hooks/useCall.js';
import { connectionManager } from '../../services/connection-manager.js';
import type { Role } from 'ecto-shared';

interface ModalData {
  userId: string;
  serverId: string;
}

function presenceLabel(status: string): string {
  switch (status) {
    case 'online': return 'Online';
    case 'idle': return 'Idle';
    case 'dnd': return 'Do Not Disturb';
    default: return 'Offline';
  }
}

export function UserProfileModal() {
  const open = useUiStore((s) => s.activeModal === 'user-profile');
  const modalData = useUiStore((s) => s.modalData) as ModalData | null;
  const close = () => useUiStore.getState().closeModal();

  if (!open || !modalData) return null;

  return <UserProfileContent data={modalData} onClose={close} />;
}

function UserProfileContent({ data, onClose }: { data: ModalData; onClose: () => void }) {
  const { userId, serverId } = data;
  const navigate = useNavigate();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const member = useMemberStore((s) => s.members.get(serverId)?.get(userId));
  const { status } = usePresence(userId);

  const friends = useFriendStore((s) => s.friends);
  const pendingIncoming = useFriendStore((s) => s.pendingIncoming);
  const pendingOutgoing = useFriendStore((s) => s.pendingOutgoing);
  const blocked = useFriendStore((s) => s.blocked);

  const { startCall } = useCall();
  const [roles, setRoles] = useState<Role[]>([]);
  const [requestSent, setRequestSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    trpc.roles.list.query().then((result) => {
      setRoles(result.sort((a, b) => b.position - a.position));
    }).catch(() => {});
  }, [serverId]);

  const isSelf = userId === currentUserId;
  const isFriend = friends.has(userId);
  const isBlocked = blocked.has(userId);
  const isLocal = member?.identity_type === 'local';

  // Find incoming request from this user
  const incomingRequest = [...pendingIncoming.values()].find((r) => r.from === userId);
  // Find outgoing request to this user (outgoing stores the target as `from`)
  const outgoingRequest = [...pendingOutgoing.values()].find((r) => r.from === userId);

  const displayName = member?.nickname ?? member?.display_name ?? member?.username ?? 'Unknown';
  const tag = member?.discriminator
    ? `${member.username}#${member.discriminator}`
    : member?.username ?? '';

  const memberRoles = roles.filter((r) => member?.roles.includes(r.id) && !r.is_default);

  const handleSendFriendRequest = useCallback(async () => {
    if (!member?.username || !member.discriminator) return;
    setError('');
    try {
      const centralTrpc = connectionManager.getCentralTrpc();
      if (!centralTrpc) throw new Error('Not connected to central');
      const result = await centralTrpc.friends.request.mutate({
        username: member.username,
        discriminator: member.discriminator,
      });
      // The WS event will also add it, but update immediately for responsiveness
      useFriendStore.getState().addOutgoingRequest({
        ...result,
        from: userId,
        from_username: member.username,
        from_discriminator: member.discriminator ?? '',
        from_avatar_url: member.avatar_url ?? null,
      });
      setRequestSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send request');
    }
  }, [member?.username, member?.discriminator]);

  const handleRemoveFriend = useCallback(async () => {
    setError('');
    try {
      const centralTrpc = connectionManager.getCentralTrpc();
      if (!centralTrpc) throw new Error('Not connected to central');
      await centralTrpc.friends.remove.mutate({ user_id: userId });
      useFriendStore.getState().removeFriend(userId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove friend');
    }
  }, [userId]);

  const handleAccept = useCallback(async () => {
    if (!incomingRequest) return;
    setError('');
    try {
      const centralTrpc = connectionManager.getCentralTrpc();
      if (!centralTrpc) throw new Error('Not connected to central');
      await centralTrpc.friends.accept.mutate({ friendship_id: incomingRequest.id });
      useFriendStore.getState().removeRequest(incomingRequest.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to accept request');
    }
  }, [incomingRequest]);

  const handleDecline = useCallback(async () => {
    if (!incomingRequest) return;
    setError('');
    try {
      const centralTrpc = connectionManager.getCentralTrpc();
      if (!centralTrpc) throw new Error('Not connected to central');
      await centralTrpc.friends.decline.mutate({ friendship_id: incomingRequest.id });
      useFriendStore.getState().removeRequest(incomingRequest.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to decline request');
    }
  }, [incomingRequest]);

  const handleBlock = useCallback(async () => {
    setError('');
    try {
      const centralTrpc = connectionManager.getCentralTrpc();
      if (!centralTrpc) throw new Error('Not connected to central');
      await centralTrpc.friends.block.mutate({ user_id: userId });
      useFriendStore.getState().blockUser(userId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to block user');
    }
  }, [userId]);

  const handleUnblock = useCallback(async () => {
    setError('');
    try {
      const centralTrpc = connectionManager.getCentralTrpc();
      if (!centralTrpc) throw new Error('Not connected to central');
      await centralTrpc.friends.unblock.mutate({ user_id: userId });
      useFriendStore.getState().unblockUser(userId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to unblock user');
    }
  }, [userId]);

  const handleSendMessage = () => {
    onClose();
    navigate(`/dms/${userId}`);
  };

  return (
    <Modal open onClose={onClose} width={400}>
      {/* Banner */}
      <div className="user-profile-banner" />

      {/* Header: avatar + names */}
      <div className="user-profile-header">
        <Avatar
          src={member?.avatar_url ?? undefined}
          username={displayName}
          size={72}
          status={status}
        />
        <div>
          <div className="user-profile-display-name">{displayName}</div>
          {tag && <div className="user-profile-tag">{tag}</div>}
          <div className={`user-profile-status ${status}`}>
            <span className={`user-profile-status-dot ${status}`} />
            {presenceLabel(status)}
          </div>
        </div>
      </div>

      <div className="user-profile-divider" />

      {/* Info sections */}
      {member?.joined_at && (
        <div className="user-profile-section">
          <div className="user-profile-section-label">Member Since</div>
          <div className="user-profile-section-content">
            {new Date(member.joined_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </div>
      )}

      {memberRoles.length > 0 && (
        <div className="user-profile-section">
          <div className="user-profile-section-label">Roles</div>
          <div className="user-profile-roles">
            {memberRoles.map((role) => (
              <span
                key={role.id}
                className="user-profile-role-pill"
                style={{
                  borderColor: role.color ?? 'var(--border)',
                  backgroundColor: role.color ? `${role.color}1a` : undefined,
                }}
              >
                <span
                  className="user-profile-role-dot"
                  style={{ backgroundColor: role.color ?? 'var(--text-muted)' }}
                />
                {role.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Local badge */}
      {isLocal && (
        <div className="user-profile-local-badge">Local Account</div>
      )}

      {/* Error display */}
      {error && <div className="auth-error" style={{ margin: '8px 0' }}>{error}</div>}

      {/* Action buttons */}
      {!isSelf && !isLocal && (
        <div className="user-profile-actions">
          {isFriend && (
            <>
              <button className="auth-button" onClick={() => { onClose(); startCall(userId, ['audio']); }}>
                Call
              </button>
              <button className="auth-button" onClick={() => { onClose(); startCall(userId, ['audio', 'video']); }}>
                Video Call
              </button>
              <button className="auth-button" onClick={handleSendMessage}>
                Send Message
              </button>
              <button className="btn-secondary" onClick={handleRemoveFriend}>
                Remove Friend
              </button>
            </>
          )}

          {incomingRequest && !isFriend && !isBlocked && (
            <>
              <button className="auth-button" onClick={handleAccept}>
                Accept
              </button>
              <button className="btn-secondary" onClick={handleDecline}>
                Decline
              </button>
            </>
          )}

          {isBlocked && (
            <button className="btn-secondary" onClick={handleUnblock}>
              Unblock
            </button>
          )}

          {!isFriend && !incomingRequest && !isBlocked && (
            <>
              {requestSent || outgoingRequest ? (
                <button className="auth-button" disabled>
                  Request Sent
                </button>
              ) : (
                <button className="auth-button" onClick={handleSendFriendRequest}>
                  Add Friend
                </button>
              )}
              <button className="btn-secondary" onClick={handleBlock}>
                Block
              </button>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
