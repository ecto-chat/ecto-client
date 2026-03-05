import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Hash, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Input, IconButton, Button, Spinner, EmptyState, ScrollArea, Switch } from '@/ui';

import { useUiStore } from '@/stores/ui';
import { useChannelStore } from '@/stores/channel';

import { connectionManager } from '@/services/connection-manager';
import { dmToMessage } from '@/lib/message-adapters';
import { easeContent } from '@/lib/animations';

import { SearchFilters, SearchResult } from '@/features/chat';

import type { Message } from 'ecto-shared';

const GROUPED_LIMIT = 5;

export function SearchSidebar() {
  const searchContext = useUiStore((s) => s.searchContext);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [searched, setSearched] = useState(false);

  // Server filters
  const [filterChannelId, setFilterChannelId] = useState('');
  const [filterAuthorId, setFilterAuthorId] = useState('');
  const [filterHasAttachment, setFilterHasAttachment] = useState(false);

  // Track whether the channel filter was set via "show more" (grouped → single-channel drill-in)
  const [groupedDrillIn, setGroupedDrillIn] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const isServer = searchContext?.type === 'server';
  const serverId = isServer ? searchContext.serverId : '';
  const userId = searchContext?.type === 'dm' ? searchContext.userId : '';
  const channelsMap = useChannelStore((s) => isServer ? s.channels.get(serverId) : undefined);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Reset state when context changes
  useEffect(() => {
    setQuery('');
    setResults([]);
    setSearched(false);
    setFilterChannelId('');
    setFilterAuthorId('');
    setFilterHasAttachment(false);
    setGroupedDrillIn(false);
  }, [searchContext?.type === 'server' ? serverId : userId]);

  const doSearch = useCallback(async (searchQuery: string, before?: string, channelOverride?: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      if (isServer) {
        const trpc = connectionManager.getServerTrpc(serverId);
        if (!trpc) return;

        const has: ('attachment' | 'link')[] = [];
        if (filterHasAttachment) has.push('attachment');

        const effectiveChannelId = channelOverride ?? filterChannelId;

        const result = await trpc.search.search.query({
          query: searchQuery.trim(),
          channel_id: effectiveChannelId || undefined,
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
      } else {
        const trpc = connectionManager.getCentralTrpc();
        if (!trpc) return;

        const has: ('attachment')[] = [];
        if (filterHasAttachment) has.push('attachment');

        const result = await trpc.dms.search.query({
          user_id: userId,
          query: searchQuery.trim(),
          has: has.length > 0 ? has : undefined,
          before,
          limit: 25,
        });
        const adapted = result.messages.map(dmToMessage);
        if (before) {
          setResults((prev) => [...prev, ...adapted]);
        } else {
          setResults(adapted);
        }
        setHasMore(result.has_more);
      }
      setSearched(true);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [isServer, serverId, userId, filterChannelId, filterAuthorId, filterHasAttachment]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) { setResults([]); doSearch(query); }
  };

  const handleLoadMore = () => {
    const last = results[results.length - 1];
    if (last) doSearch(query, last.id);
  };

  const handleClose = () => {
    useUiStore.getState().closeSearchSidebar();
  };

  const handleResultClick = (msg: Message) => {
    if (isServer) {
      navigate(`/servers/${serverId}/channels/${msg.channel_id}`);
    }
    useUiStore.getState().setPendingJumpMessageId(msg.id);
  };

  const handleShowMoreInChannel = (channelId: string) => {
    setFilterChannelId(channelId);
    setGroupedDrillIn(true);
    setResults([]);
    doSearch(query, undefined, channelId);
  };

  const handleBackToAll = () => {
    setFilterChannelId('');
    setGroupedDrillIn(false);
    setResults([]);
    doSearch(query);
  };

  // In server mode without a channel filter, group results by channel
  const isGroupedMode = isServer && !filterChannelId;

  const groupedResults = useMemo(() => {
    if (!isGroupedMode) return null;
    const groups = new Map<string, Message[]>();
    for (const msg of results) {
      const existing = groups.get(msg.channel_id);
      if (existing) {
        existing.push(msg);
      } else {
        groups.set(msg.channel_id, [msg]);
      }
    }
    return groups;
  }, [isGroupedMode, results]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={easeContent}
      className="flex w-[240px] min-w-[240px] flex-col bg-tertiary overflow-hidden border-l-3 border-primary"
    >
      {/* Header */}
      <div className="flex h-[60px] shrink-0 items-center gap-2 border-b-2 border-primary px-3">
        <IconButton variant="ghost" size="sm" tooltip="Close search" onClick={handleClose}>
          <ArrowLeft size={16} />
        </IconButton>
        <span className="text-sm font-medium text-primary">Search</span>
      </div>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="flex gap-2 px-3 py-2">
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
          Go
        </Button>
      </form>

      {/* Filters */}
      {isServer ? (
        <SearchFilters
          serverId={serverId}
          filterChannelId={filterChannelId}
          onChannelChange={(id) => { setFilterChannelId(id); setGroupedDrillIn(false); }}
          filterAuthorId={filterAuthorId}
          onAuthorChange={setFilterAuthorId}
          filterHasAttachment={filterHasAttachment}
          onAttachmentChange={setFilterHasAttachment}
        />
      ) : (
        <div className="flex items-center gap-2 border-b-2 border-primary px-3 py-2">
          <Switch
            label="Has attachment"
            checked={filterHasAttachment}
            onCheckedChange={setFilterHasAttachment}
          />
        </div>
      )}

      {/* Results */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-px p-1">
          <AnimatePresence>
            {searched && results.length === 0 && !loading && (
              <EmptyState icon={<Search />} title="No results found" className="py-8" />
            )}

            {/* Back link when drilled into a single channel from grouped view */}
            {groupedDrillIn && filterChannelId && (
              <button
                onClick={handleBackToAll}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-accent hover:underline cursor-pointer"
              >
                <ArrowLeft size={12} />
                Back to all results
              </button>
            )}

            {/* Server mode: grouped by channel */}
            {isGroupedMode && groupedResults && [...groupedResults.entries()].map(([channelId, msgs]) => {
              const channelName = channelsMap?.get(channelId)?.name ?? 'unknown';
              const shown = msgs.slice(0, GROUPED_LIMIT);
              const hasMoreInChannel = msgs.length > GROUPED_LIMIT;

              return (
                <div key={channelId} className="mb-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5">
                    <Hash size={12} className="text-muted" />
                    <span className="text-xs font-medium text-muted">{channelName}</span>
                  </div>
                  {shown.map((msg) => (
                    <SearchResult
                      key={msg.id}
                      message={msg}
                      onClick={() => handleResultClick(msg)}
                    />
                  ))}
                  {hasMoreInChannel && (
                    <button
                      onClick={() => handleShowMoreInChannel(channelId)}
                      className="w-full px-3 py-1 text-xs text-accent hover:underline cursor-pointer text-left"
                    >
                      Show more in #{channelName}
                    </button>
                  )}
                </div>
              );
            })}

            {/* Flat list: DM mode or single-channel filter */}
            {!isGroupedMode && results.map((msg) => (
              <SearchResult
                key={msg.id}
                message={msg}
                channelName={isServer ? channelsMap?.get(msg.channel_id)?.name : undefined}
                onClick={() => handleResultClick(msg)}
              />
            ))}
          </AnimatePresence>
          {hasMore && !loading && !isGroupedMode && (
            <div className="flex justify-center py-2">
              <Button variant="ghost" size="sm" onClick={handleLoadMore}>Load More</Button>
            </div>
          )}
          {loading && results.length > 0 && (
            <div className="flex justify-center py-3"><Spinner size="sm" /></div>
          )}
        </div>
      </ScrollArea>
    </motion.div>
  );
}
