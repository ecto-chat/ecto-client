import { useRef, useCallback } from 'react';

import type { KlipyGif } from '@/lib/klipy';

type GifGridProps = {
  gifs: KlipyGif[];
  loading: boolean;
  hasMore: boolean;
  onSelect: (url: string) => void;
  onLoadMore: () => void;
};

export function GifGrid({ gifs, loading, hasMore, onSelect, onLoadMore }: GifGridProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node || !hasMore) return;
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      });
      observerRef.current.observe(node);
    },
    [hasMore, onLoadMore],
  );

  if (gifs.length === 0 && !loading) {
    return <div className="text-center text-muted text-sm py-8">No GIFs found</div>;
  }

  // Split into two columns by alternating
  const col1: KlipyGif[] = [];
  const col2: KlipyGif[] = [];
  gifs.forEach((gif, i) => (i % 2 === 0 ? col1 : col2).push(gif));

  return (
    <div>
      <div className="grid grid-cols-2 gap-1">
        <div className="flex flex-col gap-1">
          {col1.map((gif) => (
            <button
              key={gif.id}
              type="button"
              className="rounded-md overflow-hidden hover:opacity-80 transition-opacity cursor-pointer"
              onClick={() => onSelect(gif.url)}
            >
              <img
                src={gif.preview_url}
                alt={gif.title}
                loading="lazy"
                className="w-full h-auto block"
              />
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {col2.map((gif) => (
            <button
              key={gif.id}
              type="button"
              className="rounded-md overflow-hidden hover:opacity-80 transition-opacity cursor-pointer"
              onClick={() => onSelect(gif.url)}
            >
              <img
                src={gif.preview_url}
                alt={gif.title}
                loading="lazy"
                className="w-full h-auto block"
              />
            </button>
          ))}
        </div>
      </div>
      {hasMore && <div ref={sentinelRef} className="h-4" />}
      {loading && (
        <div className="text-center text-muted text-sm py-2">Loading...</div>
      )}
    </div>
  );
}
