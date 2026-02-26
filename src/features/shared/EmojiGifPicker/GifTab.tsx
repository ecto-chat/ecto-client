import { ScrollArea } from '@/ui/ScrollArea';

import { GifGrid } from './GifGrid';
import { useGifSearch } from './useGifSearch';

type GifTabProps = {
  onSelect: (url: string) => void;
};

export function GifTab({ onSelect }: GifTabProps) {
  const { query, gifs, loading, hasMore, handleQueryChange, loadMore } = useGifSearch();

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-2 pb-2">
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search KLIPY"
          className="w-full px-3 py-1.5 bg-tertiary rounded-md text-sm text-primary placeholder:text-muted outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* GIF grid */}
      <ScrollArea className="flex-1 min-h-0" fadeEdges={false}>
        <div className="px-2 pb-2">
          <GifGrid
            gifs={gifs}
            loading={loading}
            hasMore={hasMore}
            onSelect={onSelect}
            onLoadMore={loadMore}
          />
        </div>
      </ScrollArea>

      {/* Attribution */}
      <div className="text-center text-[10px] text-muted py-1 border-t border-primary">
        Powered by KLIPY
      </div>
    </div>
  );
}
