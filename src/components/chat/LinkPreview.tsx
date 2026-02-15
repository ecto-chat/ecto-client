import { useState, useEffect } from 'react';
import { extractUrls, fetchLinkPreview, type LinkPreviewData } from '../../lib/link-preview.js';

interface LinkPreviewProps {
  content: string;
}

export function LinkPreviews({ content }: LinkPreviewProps) {
  const [previews, setPreviews] = useState<LinkPreviewData[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const urls = extractUrls(content);
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
    <>
      {visible.map((preview) => (
        <div key={preview.url} className="link-preview" onClick={() => window.open(preview.url, '_blank')}>
          {preview.image && (
            <img src={preview.image} alt="" className="link-preview-image" />
          )}
          <div className="link-preview-info">
            {preview.siteName && (
              <span className="link-preview-site">{preview.siteName}</span>
            )}
            {preview.title && (
              <span className="link-preview-title">{preview.title}</span>
            )}
            {preview.description && (
              <span className="link-preview-desc">{preview.description}</span>
            )}
          </div>
          <button
            className="link-preview-dismiss"
            onClick={(e) => {
              e.stopPropagation();
              setDismissed((prev) => new Set(prev).add(preview.url));
            }}
            title="Dismiss"
          >
            &#10005;
          </button>
        </div>
      ))}
    </>
  );
}
