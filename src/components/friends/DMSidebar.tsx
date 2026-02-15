import { useNavigate } from 'react-router-dom';
import { useDmStore } from '../../stores/dm.js';
import { usePresenceStore } from '../../stores/presence.js';
import { useAuthStore } from '../../stores/auth.js';
import { useUiStore } from '../../stores/ui.js';
import { Avatar } from '../common/Avatar.js';
import type { PresenceStatus } from 'ecto-shared';

export function DMSidebar() {
  const conversations = useDmStore((s) => s.conversations);
  const presences = usePresenceStore((s) => s.presences);
  const openConversationId = useDmStore((s) => s.openConversationId);
  const centralAuthState = useAuthStore((s) => s.centralAuthState);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const isCentral = centralAuthState === 'authenticated';

  const sortedConversations = isCentral
    ? [...conversations.values()].sort((a, b) => {
        const aTime = a.last_message?.created_at ?? '';
        const bTime = b.last_message?.created_at ?? '';
        return bTime.localeCompare(aTime);
      })
    : [];

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

      {isCentral ? (
        <>
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
        </>
      ) : (
        <div className="dm-sidebar-gated">
          <p className="dm-sidebar-gated-text">
            Sign in to Ecto Central to access DMs.
          </p>
        </div>
      )}

      {/* User bar at bottom */}
      <div className="user-bar">
        <Avatar src={user?.avatar_url ?? null} username={user?.username ?? '?'} size={32} />
        <div className="user-bar-info">
          <div className="user-bar-name">{user?.display_name ?? user?.username ?? 'User'}</div>
          <div className="user-bar-status">#{user?.discriminator ?? '0000'}</div>
        </div>
        <button
          className="user-bar-gear"
          onClick={() => useUiStore.getState().openModal('user-settings')}
          title="User Settings"
        >
          &#9881;
        </button>
      </div>
    </div>
  );
}
