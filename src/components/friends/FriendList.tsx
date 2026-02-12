import { useState, useCallback, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFriendStore } from '../../stores/friend.js';
import { usePresenceStore } from '../../stores/presence.js';
import { connectionManager } from '../../services/connection-manager.js';
import { Avatar } from '../common/Avatar.js';
import type { PresenceStatus } from 'ecto-shared';

type Tab = 'online' | 'all' | 'pending' | 'blocked' | 'add';

export function FriendList() {
  const [activeTab, setActiveTab] = useState<Tab>('online');
  const friends = useFriendStore((s) => s.friends);
  const pendingIncoming = useFriendStore((s) => s.pendingIncoming);
  const pendingOutgoing = useFriendStore((s) => s.pendingOutgoing);
  const blocked = useFriendStore((s) => s.blocked);
  const presences = usePresenceStore((s) => s.presences);
  const navigate = useNavigate();

  const friendList = [...friends.values()];
  const onlineFriends = friendList.filter((f) => {
    const p = presences.get(f.user_id);
    return p && p.status !== 'offline';
  });

  const handleMessage = (userId: string) => {
    navigate(`/dms/${userId}`);
  };

  const handleRemove = useCallback(async (userId: string) => {
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;
    await centralTrpc.friends.remove.mutate({ user_id: userId });
    useFriendStore.getState().removeFriend(userId);
  }, []);

  const handleBlock = useCallback(async (userId: string) => {
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;
    await centralTrpc.friends.block.mutate({ user_id: userId });
    useFriendStore.getState().blockUser(userId);
  }, []);

  const handleUnblock = useCallback(async (userId: string) => {
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;
    await centralTrpc.friends.unblock.mutate({ user_id: userId });
    useFriendStore.getState().unblockUser(userId);
  }, []);

  const handleAccept = useCallback(async (requestId: string) => {
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;
    await centralTrpc.friends.accept.mutate({ friendship_id: requestId });
    useFriendStore.getState().removeRequest(requestId);
  }, []);

  const handleDecline = useCallback(async (requestId: string) => {
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;
    await centralTrpc.friends.decline.mutate({ friendship_id: requestId });
    useFriendStore.getState().removeRequest(requestId);
  }, []);

  const handleCancel = useCallback(async (requestId: string) => {
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;
    // Cancel outgoing = decline the friendship_id
    await centralTrpc.friends.decline.mutate({ friendship_id: requestId });
    useFriendStore.getState().removeRequest(requestId);
  }, []);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'online', label: 'Online', count: onlineFriends.length },
    { id: 'all', label: 'All', count: friendList.length },
    { id: 'pending', label: 'Pending', count: pendingIncoming.size + pendingOutgoing.size },
    { id: 'blocked', label: 'Blocked', count: blocked.size },
    { id: 'add', label: 'Add Friend' },
  ];

  return (
    <div className="friend-list">
      <div className="friend-list-header">
        <h2>Friends</h2>
        <div className="friend-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`friend-tab ${activeTab === tab.id ? 'active' : ''} ${tab.id === 'add' ? 'add-friend-tab' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="tab-count">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="friend-list-content">
        {activeTab === 'online' &&
          onlineFriends.map((f) => (
            <FriendRow
              key={f.user_id}
              userId={f.user_id}
              username={f.username}
              avatarUrl={f.avatar_url}
              status={(presences.get(f.user_id)?.status ?? 'offline') as PresenceStatus}
              onMessage={handleMessage}
              onRemove={handleRemove}
              onBlock={handleBlock}
            />
          ))}

        {activeTab === 'all' &&
          friendList.map((f) => (
            <FriendRow
              key={f.user_id}
              userId={f.user_id}
              username={f.username}
              avatarUrl={f.avatar_url}
              status={(presences.get(f.user_id)?.status ?? 'offline') as PresenceStatus}
              onMessage={handleMessage}
              onRemove={handleRemove}
              onBlock={handleBlock}
            />
          ))}

        {activeTab === 'pending' && (
          <>
            {[...pendingIncoming.values()].map((req) => (
              <div key={req.id} className="friend-request-row">
                <Avatar src={req.from_avatar_url} username={req.from_username} size={40} />
                <div className="friend-request-info">
                  <span className="friend-name">{req.from_username}</span>
                  <span className="friend-request-label">Incoming Friend Request</span>
                </div>
                <div className="friend-actions">
                  <button className="btn-accept" onClick={() => handleAccept(req.id)}>Accept</button>
                  <button className="btn-secondary" onClick={() => handleDecline(req.id)}>Decline</button>
                </div>
              </div>
            ))}
            {[...pendingOutgoing.values()].map((req) => (
              <div key={req.id} className="friend-request-row">
                <Avatar src={req.from_avatar_url} username={req.from_username} size={40} />
                <div className="friend-request-info">
                  <span className="friend-name">{req.from_username}</span>
                  <span className="friend-request-label">Outgoing Friend Request</span>
                </div>
                <div className="friend-actions">
                  <button className="btn-secondary" onClick={() => handleCancel(req.id)}>Cancel</button>
                </div>
              </div>
            ))}
            {pendingIncoming.size === 0 && pendingOutgoing.size === 0 && (
              <div className="friend-empty">No pending friend requests.</div>
            )}
          </>
        )}

        {activeTab === 'blocked' && (
          <>
            {[...blocked].map((userId) => (
              <div key={userId} className="friend-row">
                <Avatar username={userId} size={40} />
                <span className="friend-name">{userId}</span>
                <div className="friend-actions">
                  <button className="btn-secondary" onClick={() => handleUnblock(userId)}>Unblock</button>
                </div>
              </div>
            ))}
            {blocked.size === 0 && <div className="friend-empty">No blocked users.</div>}
          </>
        )}

        {activeTab === 'add' && <AddFriendForm />}
      </div>
    </div>
  );
}

function FriendRow({
  userId,
  username,
  avatarUrl,
  status,
  onMessage,
  onRemove,
  onBlock,
}: {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  status: PresenceStatus;
  onMessage: (userId: string) => void;
  onRemove: (userId: string) => Promise<void>;
  onBlock: (userId: string) => Promise<void>;
}) {
  return (
    <div className="friend-row">
      <Avatar src={avatarUrl} username={username} size={40} status={status} />
      <div className="friend-info">
        <span className="friend-name">{username}</span>
        <span className="friend-status">{status}</span>
      </div>
      <div className="friend-actions">
        <button className="icon-btn" onClick={() => onMessage(userId)} title="Message">
          &#128172;
        </button>
        <button className="icon-btn" onClick={() => onRemove(userId)} title="Remove">
          &times;
        </button>
      </div>
    </div>
  );
}

function AddFriendForm() {
  const [tag, setTag] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tag.trim()) return;

    setStatus('sending');
    setError('');

    try {
      const centralTrpc = connectionManager.getCentralTrpc();
      if (!centralTrpc) throw new Error('Not connected');

      // Parse tag format: Username#0000
      const parts = tag.trim().split('#');
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new Error('Invalid format. Use Username#0000');
      }
      const [username, discriminator] = parts as [string, string];

      await centralTrpc.friends.request.mutate({ username, discriminator });
      setStatus('success');
      setTag('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send request');
      setStatus('error');
    }
  };

  return (
    <div className="add-friend-form">
      <h3>Add Friend</h3>
      <p>You can add a friend with their username and tag. It's cAsE sEnSiTiVe!</p>
      <form onSubmit={handleSubmit}>
        <div className="add-friend-input-row">
          <input
            type="text"
            value={tag}
            onChange={(e) => { setTag(e.target.value); setStatus('idle'); }}
            placeholder="Username#0000"
            className="auth-input"
          />
          <button type="submit" disabled={status === 'sending' || !tag.trim()} className="auth-button">
            Send Friend Request
          </button>
        </div>
        {status === 'success' && (
          <div className="add-friend-success">Friend request sent!</div>
        )}
        {status === 'error' && <div className="auth-error">{error}</div>}
      </form>
    </div>
  );
}
