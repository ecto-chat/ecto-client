/** Reserved ecto.chat subdomains that are NOT server addresses */
const RESERVED_SUBDOMAINS = new Set(['app', 'api', 'media', 'accounts', 'www']);

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

/**
 * Check if a URL points to an ecto server (for filtering generic link previews).
 */
export function isEctoServerUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (!hostname.endsWith('.ecto.chat')) return false;
    const firstLabel = hostname.split('.')[0]!;
    return !RESERVED_SUBDOMAINS.has(firstLabel);
  } catch {
    return false;
  }
}
