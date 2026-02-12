import { useNavigate } from 'react-router-dom';
import { useDmStore } from '../../stores/dm.js';
import { usePresenceStore } from '../../stores/presence.js';
import { Avatar } from '../common/Avatar.js';
import type { PresenceStatus } from 'ecto-shared';

export function DMSidebar() {
  const conversations = useDmStore((s) => s.conversations);
  const presences = usePresenceStore((s) => s.presences);
  const openConversationId = useDmStore((s) => s.openConversationId);
  const navigate = useNavigate();

  const sortedConversations = [...conversations.values()].sort((a, b) => {
    const aTime = a.last_message?.created_at ?? '';
    const bTime = b.last_message?.created_at ?? '';
    return bTime.localeCompare(aTime);
  });

  return (
    <div className="dm-sidebar">
      <div className="dm-sidebar-header">
        <h2>Direct Messages</h2>
      </div>

      <div
        className={`dm-sidebar-item friends-link ${openConversationId === null ? 'active' : ''}`}
        onClick={() => navigate('/friends')}
      >
        <span className="dm-sidebar-icon">&#128101;</span>
        <span>Friends</span>
      </div>

      <div className="dm-sidebar-label">Direct Messages</div>

      <div className="dm-list">
        {sortedConversations.map((conv) => {
          const presence = presences.get(conv.user_id);
          const status = (presence?.status ?? 'offline') as PresenceStatus;
          const isActive = openConversationId === conv.user_id;
          const lastContent = conv.last_message?.content;

          return (
            <div
              key={conv.user_id}
              className={`dm-sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => navigate(`/dms/${conv.user_id}`)}
            >
              <Avatar
                src={conv.avatar_url}
                username={conv.username}
                size={32}
                status={status}
              />
              <div className="dm-sidebar-info">
                <span className="dm-sidebar-name">{conv.username}</span>
                {lastContent && (
                  <span className="dm-sidebar-preview">
                    {lastContent.length > 30 ? lastContent.slice(0, 30) + '...' : lastContent}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
