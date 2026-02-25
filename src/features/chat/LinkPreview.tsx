import { useState, useEffect } from 'react';

import { AnimatePresence, motion } from 'motion/react';
import { X, ExternalLink } from 'lucide-react';

import { IconButton } from '@/ui';

import { extractUrls, fetchLinkPreview, type LinkPreviewData } from '@/lib/link-preview';

type LinkPreviewProps = {
  content: string;
  excludeUrls?: string[];
};

export function LinkPreviews({ content, excludeUrls }: LinkPreviewProps) {
  const [previews, setPreviews] = useState<LinkPreviewData[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let urls = extractUrls(content);
    if (excludeUrls && excludeUrls.length > 0) {
      urls = urls.filter((url) => !excludeUrls.some((addr) => url.includes(addr)));
    }
    if (urls.length === 0) {
      setPreviews([]);
      return;
    }

    // Fetch previews for first 3 URLs
    const toFetch = urls.slice(0, 3);
    let cancelled = false;

    Promise.all(toFetch.map(fetchLinkPreview)).then((results) => {
      if (cancelled) return;
      setPreviews(results.filter((r): r is LinkPreviewData => r !== null));
    });

    return () => { cancelled = true; };
  }, [content]);

  const visible = previews.filter((p) => !dismissed.has(p.url));
  if (visible.length === 0) return null;

  return (
    <AnimatePresence>
      {visible.map((preview) => (
        <motion.div
          key={preview.url}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-2 flex cursor-pointer overflow-hidden rounded-md border-2 border-primary bg-secondary hover:bg-hover transition-colors"
          onClick={() => window.open(preview.url, '_blank')}
        >
          {preview.image && (
            <img
              src={preview.image}
              alt=""
              className="h-20 w-20 shrink-0 object-cover"
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-2.5">
            {preview.siteName && (
              <span className="flex items-center gap-1 text-xs text-muted">
                <ExternalLink size={10} />
                {preview.siteName}
              </span>
            )}
            {preview.title && (
              <span className="truncate text-sm text-accent">{preview.title}</span>
            )}
            {preview.description && (
              <span className="line-clamp-2 text-xs text-secondary">{preview.description}</span>
            )}
          </div>
          <IconButton
            variant="ghost"
            size="sm"
            className="m-1 shrink-0"
            tooltip="Dismiss"
            onClick={(e) => {
              e.stopPropagation();
              setDismissed((prev) => new Set(prev).add(preview.url));
            }}
          >
            <X size={14} />
          </IconButton>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
