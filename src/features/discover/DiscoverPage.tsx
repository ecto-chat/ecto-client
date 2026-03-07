import { useState, useEffect, useCallback, useRef } from 'react';
import { Compass, Server, Search } from 'lucide-react';
import type { DiscoveryServer } from 'ecto-shared';
import { connectionManager } from '@/services/connection-manager';
import { useDiscoverStore } from '@/stores/discover';
import { Spinner } from '@/ui/Spinner';
import { ScrollArea } from '@/ui/ScrollArea';
import { Input } from '@/ui/Input';
import { toServerUrl } from '@/lib/server-address';
import { FeaturedPost } from './FeaturedPost';
import { FeaturedServerCard } from './FeaturedServerCard';
import { SearchServerCard } from './SearchServerCard';
import { PostCard } from './PostCard';

const CAROUSEL_INTERVAL = 8000; // 8 seconds per slide
const MAX_CAROUSEL = 5; // max posts in the carousel rotation

export function DiscoverPage() {
  const posts = useDiscoverStore((s) => s.posts);
  const loading = useDiscoverStore((s) => s.loading);
  const hasMore = useDiscoverStore((s) => s.hasMore);
  const [activeIndex, setActiveIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const [featuredServers, setFeaturedServers] = useState<DiscoveryServer[]>([]);
  const searchQuery = useDiscoverStore((s) => s.searchQuery);
  const searchResults = useDiscoverStore((s) => s.searchResults);
  const searchLoading = useDiscoverStore((s) => s.searchLoading);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearchChange = (value: string) => {
    const store = useDiscoverStore.getState();
    store.setSearchQuery(value);

    clearTimeout(debounceRef.current);
    if (!value.trim()) {
      store.clearSearch();
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const centralTrpc = connectionManager.getCentralTrpc();
      if (!centralTrpc) return;
      store.setSearchLoading(true);
      try {
        const res = await centralTrpc.discovery.getServers.query({ query: value.trim(), limit: 20 });
        store.setSearchResults(res.servers);
        // Check online status for self-hosted servers
        for (const srv of res.servers) {
          if (!srv.address.endsWith('.ecto.chat')) {
            fetch(`${toServerUrl(srv.address)}/trpc/server.info`, {
              method: 'GET',
              signal: AbortSignal.timeout(5000),
            })
              .then((r) => store.setSearchOnlineStatus(srv.server_id, r.ok))
              .catch(() => store.setSearchOnlineStatus(srv.server_id, false));
          }
        }
      } catch {
        store.setSearchResults([]);
      } finally {
        store.setSearchLoading(false);
      }
    }, 300);
  };

  const isSearchActive = searchQuery.trim().length > 0;

  const load = useCallback(async () => {
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;

    useDiscoverStore.getState().setLoading(true);
    try {
      const [feedRes, serversRes] = await Promise.all([
        centralTrpc.discovery.getFeed.query({ limit: 20 }),
        centralTrpc.discovery.getServers.query({ limit: 12 }),
      ]);
      useDiscoverStore.getState().setPosts(feedRes.posts);
      useDiscoverStore.getState().setHasMore(feedRes.has_more);
      const featured = serversRes.servers.filter((s) => s.featured);
      setFeaturedServers(featured);
      useDiscoverStore.getState().fetchLiveStats(
        featured.map((s) => ({ server_id: s.server_id, address: s.address })),
      );
    } catch {
      // Silently handle errors
    } finally {
      useDiscoverStore.getState().setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;
    const lastPost = posts[posts.length - 1];
    if (!lastPost) return;

    useDiscoverStore.getState().setLoading(true);
    try {
      const res = await centralTrpc.discovery.getFeed.query({
        before: lastPost.published_at,
        limit: 20,
      });
      useDiscoverStore.getState().appendPosts(res.posts);
      useDiscoverStore.getState().setHasMore(res.has_more);
      useDiscoverStore.getState().fetchLiveStats();
    } catch {
      // Silently handle errors
    } finally {
      useDiscoverStore.getState().setLoading(false);
    }
  }, [posts, hasMore, loading]);

  useEffect(() => {
    load();
    return () => useDiscoverStore.getState().clear();
  }, [load]);

  // Carousel: featured posts (ordered by featured_order 1-5), then remaining
  const featuredPosts = posts
    .filter((p) => p.featured_order !== null)
    .sort((a, b) => (a.featured_order ?? 0) - (b.featured_order ?? 0));
  const nonFeaturedPosts = posts.filter((p) => p.featured_order === null);
  const carouselPosts = featuredPosts.length > 0
    ? featuredPosts.slice(0, MAX_CAROUSEL)
    : posts.slice(0, MAX_CAROUSEL);
  const remainingPosts = featuredPosts.length > 0
    ? [...nonFeaturedPosts]
    : posts.slice(MAX_CAROUSEL);

  // Auto-rotate carousel
  useEffect(() => {
    if (carouselPosts.length <= 1) return;
    timerRef.current = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setActiveIndex((i) => (i + 1) % carouselPosts.length);
        setAnimating(false);
        setProgressKey((k) => k + 1);
      }, 300);
    }, CAROUSEL_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [carouselPosts.length]);

  const handleSubClick = (clickedIndex: number) => {
    // clickedIndex is relative to the sub-list (excludes activeIndex)
    // Map it back to the carousel index
    const subPosts = carouselPosts.filter((_, i) => i !== activeIndex);
    const clickedPost = subPosts[clickedIndex];
    if (!clickedPost) return;
    const newIndex = carouselPosts.indexOf(clickedPost);
    if (newIndex === -1) return;

    // Reset timer and restart auto-rotate
    clearInterval(timerRef.current);
    setAnimating(true);
    setTimeout(() => {
      setActiveIndex(newIndex);
      setAnimating(false);
      setProgressKey((k) => k + 1);

      // Restart auto-rotate
      timerRef.current = setInterval(() => {
        setAnimating(true);
        setTimeout(() => {
          setActiveIndex((i) => (i + 1) % carouselPosts.length);
          setAnimating(false);
          setProgressKey((k2) => k2 + 1);
        }, 300);
      }, CAROUSEL_INTERVAL);
    }, 300);
  };

  // Reset activeIndex when posts change
  useEffect(() => {
    setActiveIndex(0);
    setProgressKey((k) => k + 1);
  }, [posts.length]);

  const activePost = carouselPosts[activeIndex];
  const subPosts = carouselPosts.filter((_, i) => i !== activeIndex);

  return (
    <div className="flex flex-1 overflow-hidden bg-primary">
      <ScrollArea className="flex-1">
        <div className="max-w-[960px] mx-auto p-6 mt-4">
          <div className="mb-6">
            <Input
              placeholder="Search servers by name or tag..."
              icon={<Search size={16} />}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>

          {isSearchActive ? (
            <div>
              {searchLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Spinner />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-20">
                  <Search size={48} className="mx-auto mb-4 text-muted" />
                  <h2 className="text-lg font-semibold text-primary mb-2">No servers found</h2>
                  <p className="text-sm text-secondary">Try a different search term.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {searchResults.map((server) => (
                    <SearchServerCard key={server.server_id} server={server} />
                  ))}
                </div>
              )}
            </div>
          ) : loading && posts.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <Spinner />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <Compass size={48} className="mx-auto mb-4 text-muted" />
              <h2 className="text-lg font-semibold text-primary mb-2">Nothing here yet</h2>
              <p className="text-sm text-secondary">Check back later for news from discoverable servers.</p>
            </div>
          ) : (
            <>
              {/* Carousel: featured + sub cards */}
              {activePost && (
                <div className="relative mb-6">
                  <div className={`transition-opacity duration-300 ${animating ? 'opacity-0' : 'opacity-100'}`}>
                    <FeaturedPost post={activePost} />
                  </div>

                  {/* Progress bar */}
                  {carouselPosts.length > 1 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 rounded-b-lg overflow-hidden">
                      <div
                        key={progressKey}
                        className="h-full bg-accent"
                        style={{
                          animation: `carousel-progress ${CAROUSEL_INTERVAL}ms linear`,
                        }}
                      />
                    </div>
                  )}

                  {/* Sub cards overlaid on right */}
                  {subPosts.length > 0 && (
                    <div className="absolute top-4 right-4 bottom-4 w-[260px] flex flex-col gap-3 overflow-hidden">
                      {subPosts.map((post, i) => (
                        <PostCard key={post.id} post={post} onClick={() => handleSubClick(i)} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Featured servers */}
              {featuredServers.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Server size={16} className="text-muted" />
                    <h2 className="text-sm font-semibold text-secondary">Featured Servers</h2>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {featuredServers.map((server) => (
                      <FeaturedServerCard key={server.server_id} server={server} />
                    ))}
                  </div>
                </div>
              )}

              {/* More posts grid */}
              {remainingPosts.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  {remainingPosts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              )}

              {hasMore && (
                <div className="flex justify-center py-6">
                  <button
                    className="px-4 py-2 text-sm bg-tertiary text-secondary rounded-md hover:bg-secondary hover:text-primary transition-colors"
                    onClick={loadMore}
                    disabled={loading}
                  >
                    {loading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      <style>{`
        @keyframes carousel-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
