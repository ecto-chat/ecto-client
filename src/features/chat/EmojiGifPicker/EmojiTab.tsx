import { useState, useRef, useCallback, useMemo } from 'react';

import { ScrollArea } from '@/ui/ScrollArea';
import { cn } from '@/lib/cn';
import {
  EMOJI_CATEGORIES,
  searchEmojis,
  getFrequentEmojis,
  type EmojiItem,
  type EmojiCategory,
} from '@/lib/emoji-data';

type EmojiTabProps = {
  onSelect: (emoji: string, item: EmojiItem) => void;
};

export function EmojiTab({ onSelect }: EmojiTabProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('frequent');
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build categories with populated frequent
  const categories = useMemo((): EmojiCategory[] => {
    const frequent = getFrequentEmojis();
    return EMOJI_CATEGORIES.map((cat) =>
      cat.id === 'frequent' ? { ...cat, emojis: frequent } : cat,
    ).filter((cat) => cat.emojis.length > 0);
  }, []);

  const searchResults = useMemo(() => {
    if (!search) return null;
    return searchEmojis(search);
  }, [search]);

  const handleCategoryClick = useCallback((id: string) => {
    const el = sectionRefs.current.get(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setActiveCategory(id);
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const scrollTop = container.scrollTop;

    // Find which section is currently most visible
    let closest = categories[0]?.id ?? 'frequent';
    let closestDist = Infinity;

    for (const cat of categories) {
      const el = sectionRefs.current.get(cat.id);
      if (!el) continue;
      const dist = Math.abs(el.offsetTop - scrollTop - container.offsetTop);
      if (dist < closestDist) {
        closestDist = dist;
        closest = cat.id;
      }
    }
    setActiveCategory(closest);
  }, [categories]);

  const setSectionRef = useCallback((id: string, node: HTMLDivElement | null) => {
    if (node) {
      sectionRefs.current.set(id, node);
    } else {
      sectionRefs.current.delete(id);
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-2 pb-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search emojis..."
          className="w-full px-3 py-1.5 bg-tertiary rounded-md text-sm text-primary placeholder:text-muted outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Emoji grid */}
      <ScrollArea ref={scrollRef} className="flex-1 min-h-0" onScroll={handleScroll} fadeEdges={false}>
        <div className="px-2 pb-2">
          {searchResults ? (
            searchResults.length > 0 ? (
              <div>
                <div className="text-xs text-muted font-medium px-1 py-1">Search Results</div>
                <div className="grid grid-cols-8 gap-0">
                  {searchResults.map((item) => (
                    <button
                      key={item.emoji + item.name}
                      type="button"
                      title={item.name}
                      className="w-9 h-9 flex items-center justify-center text-xl rounded-md hover:bg-hover transition-colors cursor-pointer"
                      onClick={() => onSelect(item.emoji, item)}
                    >
                      {item.emoji}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-muted text-sm py-8">No emojis found</div>
            )
          ) : (
            categories.map((cat) => (
              <div key={cat.id} ref={(node) => setSectionRef(cat.id, node)}>
                <div className="text-xs text-muted font-medium px-1 py-1 sticky top-0 bg-surface z-10">
                  {cat.name}
                </div>
                <div className="grid grid-cols-8 gap-0">
                  {cat.emojis.map((item) => (
                    <button
                      key={item.emoji + item.name}
                      type="button"
                      title={item.name}
                      className="w-9 h-9 flex items-center justify-center text-xl rounded-md hover:bg-hover transition-colors cursor-pointer"
                      onClick={() => onSelect(item.emoji, item)}
                    >
                      {item.emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Category nav bar */}
      {!searchResults && (
        <div className="flex items-center justify-around px-1 py-1 border-t border-primary">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              title={cat.name}
              className={cn(
                'w-7 h-7 flex items-center justify-center text-base rounded-md transition-colors cursor-pointer',
                activeCategory === cat.id ? 'bg-hover' : 'hover:bg-hover/50',
              )}
              onClick={() => handleCategoryClick(cat.id)}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
