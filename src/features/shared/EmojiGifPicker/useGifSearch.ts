import { useState, useEffect, useRef, useCallback } from 'react';

import { searchGifs, getTrendingGifs, type KlipyGif } from '@/lib/klipy';

export function useGifSearch() {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<KlipyGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const abortRef = useRef<AbortController>(null);

  // Fetch trending on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTrendingGifs(1, 20).then((result) => {
      if (cancelled) return;
      setGifs(result.gifs);
      setHasMore(result.hasNext);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const doSearch = useCallback((q: string, p: number, append: boolean) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    const fetcher = q ? searchGifs(q, p, 20) : getTrendingGifs(p, 20);
    fetcher.then((result) => {
      if (controller.signal.aborted) return;
      setGifs((prev) => append ? [...prev, ...result.gifs] : result.gifs);
      setHasMore(result.hasNext);
      setLoading(false);
    });
  }, []);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(value, 1, false);
    }, 300);
  }, [doSearch]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    doSearch(query, nextPage, true);
  }, [loading, hasMore, page, query, doSearch]);

  return { query, gifs, loading, hasMore, handleQueryChange, loadMore };
}
