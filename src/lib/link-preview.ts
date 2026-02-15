export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

const cache = new Map<string, LinkPreviewData | null>();

/** Extract URLs from text */
export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"')\]]+/gi;
  return [...new Set(text.match(urlRegex) ?? [])];
}

/** Fetch Open Graph metadata for a URL */
export async function fetchLinkPreview(url: string): Promise<LinkPreviewData | null> {
  if (cache.has(url)) return cache.get(url) ?? null;

  try {
    // Fetch through a simple proxy or directly (will fail on CORS-restricted sites)
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'text/html' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      cache.set(url, null);
      return null;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      cache.set(url, null);
      return null;
    }

    const html = await response.text();
    const data = parseOgTags(html, url);
    cache.set(url, data);
    return data;
  } catch {
    cache.set(url, null);
    return null;
  }
}

function parseOgTags(html: string, url: string): LinkPreviewData | null {
  const getMeta = (property: string): string | undefined => {
    // Match both og: prefix and name/property attributes
    const regex = new RegExp(
      `<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`,
      'i',
    );
    const altRegex = new RegExp(
      `<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
      'i',
    );
    return regex.exec(html)?.[1] ?? altRegex.exec(html)?.[1];
  };

  const title = getMeta('og:title') ?? getMeta('twitter:title');
  const description = getMeta('og:description') ?? getMeta('twitter:description') ?? getMeta('description');
  const image = getMeta('og:image') ?? getMeta('twitter:image');
  const siteName = getMeta('og:site_name');

  if (!title && !description) return null;

  return {
    url,
    title: title ?? undefined,
    description: description ?? undefined,
    image: image ?? undefined,
    siteName: siteName ?? undefined,
  };
}
