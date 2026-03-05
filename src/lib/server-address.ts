const GATEWAY_URL = (import.meta.env.VITE_GATEWAY_URL as string | undefined)?.replace(/\/+$/, '');

/**
 * Convert a server address (hostname or URL) to a full HTTP(S) URL.
 * Routes managed *.ecto.chat servers through the gateway when VITE_GATEWAY_URL is set.
 */
export function toServerUrl(address: string): string {
  if (address.startsWith('http://') || address.startsWith('https://')) {
    return address.replace(/\/+$/, '');
  }
  // Route managed ecto.chat servers through local gateway in dev
  if (GATEWAY_URL && address.endsWith('.ecto.chat')) {
    return `${GATEWAY_URL}/${address}`;
  }
  const isLocal = /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address);
  const protocol = isLocal ? 'http' : 'https';
  return `${protocol}://${address}`.replace(/\/+$/, '');
}

/** Reserved ecto.chat subdomains that are NOT server addresses */
const RESERVED_SUBDOMAINS = new Set(['app', 'api', 'media', 'accounts', 'www', 'docs']);

/**
 * Regex to match ecto server addresses in message text.
 * Matches both `https://` prefixed and plain-text addresses like `s-abc123.ecto.chat`.
 * Excludes reserved subdomains (app, api, media, accounts, www).
 */
const ECTO_ADDRESS_RE =
  /(?:https?:\/\/)?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.ecto\.chat)(?:\/[^\s]*)?/gi;

/**
 * Extract ecto server addresses from message text.
 * Returns up to 3 unique addresses (hostname only, no protocol/path).
 */
export function extractServerAddresses(text: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const match of text.matchAll(ECTO_ADDRESS_RE)) {
    const hostname = match[1]!.toLowerCase();
    // Skip reserved subdomains
    const firstLabel = hostname.split('.')[0]!;
    if (RESERVED_SUBDOMAINS.has(firstLabel)) continue;
    if (seen.has(hostname)) continue;
    seen.add(hostname);
    results.push(hostname);
    if (results.length >= 3) break;
  }

  return results;
}

