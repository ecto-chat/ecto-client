import { useState, useCallback, useRef, useEffect } from 'react';
import { connectionManager } from '../../services/connection-manager.js';
import { useUiStore } from '../../stores/ui.js';
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(async (searchQuery: string, before?: string) => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc || !searchQuery.trim()) return;

    setLoading(true);
    try {
      const result = await trpc.search.search.query({
        query: searchQuery.trim(),
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
  }, [serverId]);

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

function SearchResult({ message, onClick }: { message: Message; onClick: () => void }) {
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
