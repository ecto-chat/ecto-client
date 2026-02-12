import { useEffect } from 'react';
import { useMembers } from '../../hooks/useMembers.js';
import { usePresence } from '../../hooks/usePresence.js';
import { useUiStore } from '../../stores/ui.js';
import { Avatar } from '../common/Avatar.js';
import type { Member } from 'ecto-shared';

export function MemberList() {
  const activeServerId = useUiStore((s) => s.activeServerId);
  const { members, loadMembers } = useMembers(activeServerId ?? '');

  useEffect(() => {
    if (activeServerId) {
      loadMembers().catch(() => {});
    }
  }, [activeServerId, loadMembers]);

  // Just display all members (presence info comes from presence store, not member objects)
  const online = members;
  const offline: typeof members = [];

  return (
    <div className="member-list">
      <div className="member-list-section">
        <h3 className="member-list-header">Online — {online.length}</h3>
        {online.map((member) => (
          <MemberItem key={member.user_id} member={member} />
        ))}
      </div>

      {offline.length > 0 && (
        <div className="member-list-section">
          <h3 className="member-list-header">Offline — {offline.length}</h3>
          {offline.map((member) => (
            <MemberItem key={member.user_id} member={member} />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberItem({ member }: { member: Member }) {
  const { status } = usePresence(member.user_id);
  const activeServerId = useUiStore((s) => s.activeServerId);

  const handleClick = () => {
    if (!activeServerId) return;
    useUiStore.getState().openModal('user-profile', { userId: member.user_id, serverId: activeServerId });
  };

  return (
    <div className="member-item" onClick={handleClick}>
      <Avatar
        src={member.avatar_url ?? undefined}
        username={member.nickname ?? member.username}
        size={32}
        status={status}
      />
      <div className="member-info">
        <span className="member-name">
          {member.nickname ?? member.username}
        </span>
      </div>
    </div>
  );
}
