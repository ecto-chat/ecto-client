import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { connectionManager } from '../../services/connection-manager.js';
import { useUiStore } from '../../stores/ui.js';
import { useChannelStore } from '../../stores/channel.js';
import { useMemberStore } from '../../stores/member.js';
import { renderMarkdown } from '../../lib/markdown.js';
import { Avatar } from '../common/Avatar.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import type { Message } from 'ecto-shared';

interface SearchPanelProps {
  serverId: string;
  onNavigate: (channelId: string, messageId: string) => void;
  onClose: () => void;
}

export function SearchPanel({ serverId, onNavigate, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const [filterChannelId, setFilterChannelId] = useState('');
  const [filterAuthorId, setFilterAuthorId] = useState('');
  const [filterHasAttachment, setFilterHasAttachment] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const channelsMap = useChannelStore((s) => s.channels.get(serverId));
  const membersMap = useMemberStore((s) => s.members.get(serverId));

  const textChannels = useMemo(() => {
    if (!channelsMap) return [];
    return Array.from(channelsMap.values())
      .filter((c) => c.type === 'text')
      .sort((a, b) => a.position - b.position);
  }, [channelsMap]);

  const members = useMemo(() => {
    if (!membersMap) return [];
    return Array.from(membersMap.values()).sort((a, b) =>
      (a.display_name ?? a.username).localeCompare(b.display_name ?? b.username),
    );
  }, [membersMap]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(async (searchQuery: string, before?: string) => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc || !searchQuery.trim()) return;

    setLoading(true);
    try {
      const has: ('attachment' | 'link')[] = [];
      if (filterHasAttachment) has.push('attachment');

      const result = await trpc.search.search.query({
        query: searchQuery.trim(),
        channel_id: filterChannelId || undefined,
        author_id: filterAuthorId || undefined,
        has: has.length > 0 ? has : undefined,
        before,
        limit: 25,
      });
      if (before) {
        setResults((prev) => [...prev, ...result.messages]);
      } else {
        setResults(result.messages);
      }
      setHasMore(result.has_more);
      setSearched(true);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [serverId, filterChannelId, filterAuthorId, filterHasAttachment]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setResults([]);
      doSearch(query);
    }
  };

  const handleLoadMore = () => {
    const last = results[results.length - 1];
    if (last) doSearch(query, last.id);
  };

  return (
    <div className="search-panel">
      <div className="search-panel-header">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flex: 1, gap: 8 }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages..."
            className="auth-input"
            style={{ flex: 1, fontSize: 14 }}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="auth-button"
            style={{ padding: '6px 16px', fontSize: 13, whiteSpace: 'nowrap' }}
          >
            {loading ? <LoadingSpinner size={14} /> : 'Search'}
          </button>
        </form>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary, #b9bbbe)',
            cursor: 'pointer',
            fontSize: 18,
            padding: '4px 8px',
            marginLeft: 4,
          }}
          title="Close search"
        >
          &#10005;
        </button>
      </div>

      <div className="search-filter-row" style={{ display: 'flex', gap: 8, padding: '6px 12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          className="auth-input"
          style={{ fontSize: 12, padding: '4px 8px', minWidth: 120 }}
          value={filterChannelId}
          onChange={(e) => setFilterChannelId(e.target.value)}
        >
          <option value="">All Channels</option>
          {textChannels.map((ch) => (
            <option key={ch.id} value={ch.id}>#{ch.name}</option>
          ))}
        </select>
        <select
          className="auth-input"
          style={{ fontSize: 12, padding: '4px 8px', minWidth: 120 }}
          value={filterAuthorId}
          onChange={(e) => setFilterAuthorId(e.target.value)}
        >
          <option value="">All Authors</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>{m.display_name ?? m.username}</option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary, #b9bbbe)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={filterHasAttachment}
            onChange={(e) => setFilterHasAttachment(e.target.checked)}
          />
          Has attachment
        </label>
      </div>

      <div className="search-panel-results">
        {searched && results.length === 0 && !loading && (
          <p style={{ color: 'var(--text-secondary, #b9bbbe)', textAlign: 'center', padding: 20 }}>
            No results found.
          </p>
        )}
        {results.map((msg) => (
          <SearchResult
            key={msg.id}
            message={msg}
            channelName={channelsMap?.get(msg.channel_id)?.name}
            onClick={() => onNavigate(msg.channel_id, msg.id)}
          />
        ))}
        {hasMore && !loading && (
          <button
            onClick={handleLoadMore}
            style={{
              display: 'block',
              margin: '8px auto',
              padding: '6px 16px',
              fontSize: 13,
              border: 'none',
              borderRadius: 4,
              backgroundColor: 'var(--bg-tertiary, #202225)',
              color: 'var(--text-primary, #fff)',
              cursor: 'pointer',
            }}
          >
            Load More
          </button>
        )}
        {loading && results.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
            <LoadingSpinner size={20} />
          </div>
        )}
      </div>
    </div>
  );
}

function SearchResult({ message, channelName, onClick }: { message: Message; channelName?: string; onClick: () => void }) {
  const timestamp = new Date(message.created_at).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="search-result" onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Avatar
          src={message.author?.avatar_url}
          username={message.author?.username ?? 'Unknown'}
          size={20}
        />
        <span style={{ fontWeight: 600, color: 'var(--text-primary, #fff)', fontSize: 13 }}>
          {message.author?.display_name ?? message.author?.username ?? 'Unknown'}
        </span>
        {channelName && (
          <span style={{
            fontSize: 11,
            color: 'var(--text-muted, #72767d)',
            background: 'var(--bg-tertiary, #202225)',
            padding: '1px 6px',
            borderRadius: 3,
          }}>
            #{channelName}
          </span>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-muted, #72767d)' }}>{timestamp}</span>
      </div>
      <div
        className="message-content message-markdown"
        style={{ fontSize: 13, color: 'var(--text-secondary, #b9bbbe)' }}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content ?? '') }}
      />
    </div>
  );
}
