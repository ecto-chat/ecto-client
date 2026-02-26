import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { Settings } from 'lucide-react';

import { Modal, Button } from '@/ui';

import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';
import { useMemberStore } from '@/stores/member';
import { useFriendStore } from '@/stores/friend';

import { usePresence } from '@/hooks/usePresence';
import { useCall } from '@/hooks/useCall';

import { connectionManager } from '@/services/connection-manager';
import { useServerStore } from '@/stores/server';
import { useServerDmStore } from '@/stores/server-dm';

import type { Role, GlobalUser } from 'ecto-shared';

import { UserProfileCard } from './UserProfileCard';
import { UserProfileActions } from './UserProfileActions';

type ModalData = {
  userId: string;
  serverId?: string;
};

export function UserProfileModal() {
  const open = useUiStore((s) => s.activeModal === 'user-profile');
  const modalData = useUiStore((s) => s.modalData) as ModalData | null;
  const close = useUiStore((s) => s.closeModal);

  if (!open || !modalData) return null;

  return (
    <UserProfileContent data={modalData} onClose={close} />
  );
}

function UserProfileContent({ data, onClose }: { data: ModalData; onClose: () => void }) {
  const { userId, serverId } = data;
  const navigate = useNavigate();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const member = useMemberStore((s) => serverId ? s.members.get(serverId)?.get(userId) : undefined);
  const { status } = usePresence(userId);

  const friends = useFriendStore((s) => s.friends);
  const pendingIncoming = useFriendStore((s) => s.pendingIncoming);
  const pendingOutgoing = useFriendStore((s) => s.pendingOutgoing);
  const blocked = useFriendStore((s) => s.blocked);

  const currentUser = useAuthStore((s) => s.user);
  const { startCall, isInCall } = useCall();
  const [roles, setRoles] = useState<Role[]>([]);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [centralProfile, setCentralProfile] = useState<GlobalUser | null>(null);

  useEffect(() => {
    if (!serverId) return;
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    trpc.roles.list.query().then((result) => {
      setRoles(result.sort((a, b) => b.position - a.position));
    }).catch(() => {});
  }, [serverId]);

  useEffect(() => {
    // For self, use auth store
    if (userId === currentUserId && currentUser) {
      setBannerUrl(currentUser.banner_url);
      return;
    }
    if (member?.identity_type === 'local') return;
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;
    centralTrpc.profile.get.query({ user_id: userId }).then((profile) => {
      setBannerUrl(profile.banner_url);
      // When no server context, use central profile for display info
      if (!serverId) setCentralProfile(profile);
    }).catch(() => {});
  }, [userId, currentUserId, currentUser, member?.identity_type, serverId]);

  const isSelf = userId === currentUserId;
  const isFriend = friends.has(userId);
  const isBlocked = blocked.has(userId);
  const isLocal = member?.identity_type === 'local';

  const incomingRequest = [...pendingIncoming.values()].find((r) => r.from === userId);
  const outgoingRequest = [...pendingOutgoing.values()].find((r) => r.from === userId);

  // Use member data when in server context, central profile or self when in DM context
  const profileSource = member ?? centralProfile ?? (isSelf ? currentUser : null);
  const displayName = member?.nickname ?? profileSource?.display_name ?? profileSource?.username ?? 'Unknown';
  const tag = profileSource && 'discriminator' in profileSource && profileSource.discriminator
    ? `${profileSource.username}#${profileSource.discriminator}`
    : profileSource?.username ?? '';
  const avatarUrl = profileSource?.avatar_url;

  const memberRoles = roles.filter((r) => member?.roles.includes(r.id) && !r.is_default);

  const allowMemberDms = useServerStore((s) =>
    serverId ? s.serverMeta.get(serverId)?.allow_member_dms ?? false : false,
  );

  const handleSendMessage = () => {
    onClose();
    navigate(`/dms/${userId}`);
  };

  const handleSendServerDm = () => {
    onClose();
    useUiStore.getState().setHubSection('server-dms');

    // Check if conversation already exists
    const conversations = useServerDmStore.getState().conversations;
    for (const [, convo] of conversations) {
      if (convo.peer.user_id === userId) {
        useServerDmStore.getState().setActiveConversation(convo.id);
        if (serverId) navigate(`/servers/${serverId}/dms/${convo.id}`);
        return;
      }
    }

    // Create placeholder conversation
    const tempId = `pending-${userId}`;
    useServerDmStore.getState().ensureConversation({
      id: tempId,
      peer: {
        user_id: userId,
        username: profileSource?.username ?? 'Unknown',
        display_name: profileSource?.display_name ?? null,
        avatar_url: profileSource?.avatar_url ?? null,
        nickname: member?.nickname ?? null,
      },
      last_message: null,
      unread_count: 0,
    });
    useServerDmStore.getState().setActiveConversation(tempId);
    if (serverId) navigate(`/servers/${serverId}/dms/${tempId}`);
  };

  return (
    <Modal open onOpenChange={(v) => { if (!v) onClose(); }} width="sm" className="overflow-hidden">
      <UserProfileCard
        displayName={displayName}
        tag={tag}
        avatarUrl={avatarUrl}
        bannerUrl={bannerUrl}
        status={status}
        createdAt={profileSource && 'created_at' in profileSource ? profileSource.created_at : undefined}
        joinedAt={member?.joined_at}
        roles={memberRoles}
        isLocal={isLocal}
      />

      {isSelf && (
        <div className="px-5 pb-3 -mx-5">
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => {
              onClose();
              useUiStore.getState().openModal('user-settings');
            }}
          >
            <Settings size={14} />
            Edit Profile
          </Button>
        </div>
      )}

      {!isSelf && (!isLocal || allowMemberDms) && (
        <UserProfileActions
          userId={userId}
          username={profileSource?.username}
          discriminator={profileSource && 'discriminator' in profileSource ? profileSource.discriminator : undefined}
          avatarUrl={avatarUrl}
          isFriend={isFriend}
          isBlocked={isBlocked}
          isLocal={isLocal}
          incomingRequest={incomingRequest}
          outgoingRequest={outgoingRequest}
          isInCall={isInCall}
          allowMemberDms={allowMemberDms}
          onClose={onClose}
          onSendMessage={handleSendMessage}
          onSendServerDm={handleSendServerDm}
          onStartCall={startCall}
        />
      )}
    </Modal>
  );
}
