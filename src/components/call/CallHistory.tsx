import { useEffect, useCallback, useState } from 'react';
import { useCallStore } from '../../stores/call.js';
import { connectionManager } from '../../services/connection-manager.js';
import { useCall } from '../../hooks/useCall.js';
import { Avatar } from '../common/Avatar.js';
import type { CallRecord } from 'ecto-shared';

type HistoryFilter = 'all' | 'missed' | 'incoming' | 'outgoing';

export function CallHistory() {
  const callHistory = useCallStore((s) => s.callHistory);
  const historyHasMore = useCallStore((s) => s.historyHasMore);
  const historyFilter = useCallStore((s) => s.historyFilter);
  const { startCall } = useCall();
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async (filter: HistoryFilter, cursor?: string) => {
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;

    setLoading(true);
    try {
      const result = await centralTrpc.calls.history.query({
        filter,
        cursor,
        limit: 25,
      });

      if (cursor) {
        useCallStore.getState().appendCallHistory(result.records, result.has_more);
      } else {
        useCallStore.getState().setCallHistory(result.records, result.has_more);
      }
    } catch (err) {
      console.error('[calls] failed to load history:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(historyFilter);
  }, [historyFilter, loadHistory]);

  const handleFilterChange = (filter: HistoryFilter) => {
    useCallStore.getState().setHistoryFilter(filter);
  };

  const handleLoadMore = () => {
    const last = callHistory[callHistory.length - 1];
    if (last) {
      loadHistory(historyFilter, last.id);
    }
  };

  const handleDelete = useCallback(async (recordId: string) => {
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;

    // Optimistic removal
    useCallStore.getState().removeCallRecord(recordId);

    try {
      await centralTrpc.calls.delete.mutate({ call_record_id: recordId });
    } catch {
      // Reload on failure
      loadHistory(historyFilter);
    }
  }, [historyFilter, loadHistory]);

  const handleCallBack = (userId: string) => {
    startCall(userId, ['audio']);
  };

  const filters: { id: HistoryFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'missed', label: 'Missed' },
    { id: 'incoming', label: 'Incoming' },
    { id: 'outgoing', label: 'Outgoing' },
  ];

  return (
    <div className="call-history">
      <div className="call-history-filters">
        {filters.map((f) => (
          <button
            key={f.id}
            className={`friend-tab ${historyFilter === f.id ? 'active' : ''}`}
            onClick={() => handleFilterChange(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="call-history-list">
        {callHistory.map((record) => (
          <CallHistoryEntry
            key={record.id}
            record={record}
            onCallBack={handleCallBack}
            onDelete={handleDelete}
          />
        ))}

        {callHistory.length === 0 && !loading && (
          <div className="friend-empty">No call history.</div>
        )}

        {historyHasMore && callHistory.length > 0 && (
          <button
            className="btn-secondary"
            onClick={handleLoadMore}
            disabled={loading}
            style={{ margin: '12px auto', display: 'block' }}
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        )}
      </div>
    </div>
  );
}

function CallHistoryEntry({
  record,
  onCallBack,
  onDelete,
}: {
  record: CallRecord;
  onCallBack: (userId: string) => void;
  onDelete: (recordId: string) => void;
}) {
  const isMissed = record.status === 'missed';
  const directionIcon = record.direction === 'outgoing' ? '\u2197' : '\u2199';

  const statusLabel = (() => {
    switch (record.status) {
      case 'missed': return 'Missed';
      case 'rejected': return 'Declined';
      case 'busy': return 'Busy';
      case 'unavailable': return 'Unavailable';
      case 'ended': return record.duration_seconds
        ? formatDuration(record.duration_seconds)
        : 'Ended';
      default: return record.status;
    }
  })();

  const timeAgo = getRelativeTime(record.created_at);

  return (
    <div
      className={`call-history-row ${isMissed ? 'call-history-missed' : ''}`}
      onContextMenu={(e) => {
        e.preventDefault();
        onDelete(record.id);
      }}
    >
      <Avatar
        src={record.peer.avatar_url}
        username={record.peer.username}
        size={40}
      />
      <div className="call-history-info">
        <div className="call-history-name">
          <span className="call-history-direction">{directionIcon}</span>
          {record.peer.display_name ?? record.peer.username}
        </div>
        <div className="call-history-meta">
          <span className={`call-history-status ${isMissed ? 'missed' : ''}`}>
            {statusLabel}
          </span>
          <span className="call-history-time">{timeAgo}</span>
        </div>
      </div>
      <div className="friend-actions">
        <button
          className="icon-btn"
          onClick={() => onCallBack(record.peer.user_id)}
          title="Call"
        >
          &#128222;
        </button>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function getRelativeTime(isoStr: string): string {
  const date = new Date(isoStr);
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
