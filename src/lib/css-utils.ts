/** Safely wrap a URL for use in CSS `background-image: url(...)`. Escapes characters that could break out of the url() context. */
export function cssUrl(url: string): string {
  const escaped = url.replace(/["\\()]/g, '\\$&');
  return `url("${escaped}")`;
}
