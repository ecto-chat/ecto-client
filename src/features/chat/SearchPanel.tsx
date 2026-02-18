import { useState, useCallback, useRef, useEffect } from 'react';

import { motion, AnimatePresence } from 'motion/react';
import { Search, X } from 'lucide-react';

import { Input, IconButton, Button, Spinner, EmptyState, ScrollArea } from '@/ui';

import { useChannelStore } from '@/stores/channel';

import { connectionManager } from '@/services/connection-manager';

import type { Message } from 'ecto-shared';

import { SearchFilters } from './SearchFilters';
import { SearchResult } from './SearchResult';

type SearchPanelProps = {
  serverId: string;
  onNavigate: (channelId: string, messageId: string) => void;
  onClose: () => void;
};

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

  useEffect(() => { inputRef.current?.focus(); }, []);

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
    if (query.trim()) { setResults([]); doSearch(query); }
  };

  const handleLoadMore = () => {
    const last = results[results.length - 1];
    if (last) doSearch(query, last.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col border-b border-border bg-secondary"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <form onSubmit={handleSubmit} className="flex flex-1 gap-2">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages..."
            icon={<Search size={14} />}
            inputSize="sm"
            className="flex-1"
          />
          <Button type="submit" variant="primary" size="sm" loading={loading && results.length === 0} disabled={!query.trim()}>
            Search
          </Button>
        </form>
        <IconButton variant="ghost" size="sm" tooltip="Close search" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </div>

      <SearchFilters
        serverId={serverId}
        filterChannelId={filterChannelId}
        onChannelChange={setFilterChannelId}
        filterAuthorId={filterAuthorId}
        onAuthorChange={setFilterAuthorId}
        filterHasAttachment={filterHasAttachment}
        onAttachmentChange={setFilterHasAttachment}
      />

      {searched && (
        <ScrollArea className="max-h-72">
          <div className="flex flex-col gap-px p-1">
            <AnimatePresence>
              {results.length === 0 && !loading && (
                <EmptyState icon={<Search />} title="No results found" className="py-8" />
              )}
              {results.map((msg) => (
                <SearchResult
                  key={msg.id}
                  message={msg}
                  channelName={channelsMap?.get(msg.channel_id)?.name}
                  onClick={() => onNavigate(msg.channel_id, msg.id)}
                />
              ))}
            </AnimatePresence>
            {hasMore && !loading && (
              <div className="flex justify-center py-2">
                <Button variant="ghost" size="sm" onClick={handleLoadMore}>Load More</Button>
              </div>
            )}
            {loading && results.length > 0 && (
              <div className="flex justify-center py-3"><Spinner size="sm" /></div>
            )}
          </div>
        </ScrollArea>
      )}
    </motion.div>
  );
}
