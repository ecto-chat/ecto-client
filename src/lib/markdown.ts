import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked for Discord-like markdown
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Custom renderer that strips raw HTML and handles mentions/spoilers
const renderer = new marked.Renderer();

// Prevent raw HTML injection — strip all tags
renderer.html = () => '';

// Open links in new tab
renderer.link = ({ href, text }) =>
  `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`;

// Render inline images with size constraints (HTTPS only)
renderer.image = ({ href, text }) => {
  if (!href || !href.startsWith('https://')) return escapeHtml(text ?? '');
  return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text ?? '')}" class="inline-image" loading="lazy" />`;
};

// Restrict image src to https:// only (block javascript:, data:, etc.)
DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  if (node.tagName === 'IMG' && data.attrName === 'src') {
    if (!data.attrValue.startsWith('https://')) {
      data.attrValue = '';
    }
  }
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface MentionResolver {
  /** Map of userId → display name for user mentions */
  members?: Map<string, string>;
  /** Map of channelId → channel name for channel mentions */
  channels?: Map<string, string>;
}

/**
 * Render a message string to sanitized HTML.
 * Supports: bold, italic, strikethrough, inline code, code blocks,
 * blockquotes, lists, links, spoilers, and mentions.
 */
export function renderMarkdown(content: string, resolver?: MentionResolver): string {
  if (!content) return '';

  const html = marked.parse(content, { renderer, async: false }) as string;

  // Post-process: apply custom syntax on the already-sanitized HTML
  let result = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'a', 'strong', 'em', 'del', 'code', 'pre', 'blockquote',
      'ul', 'ol', 'li', 'br', 'p', 'span', 'h1', 'h2', 'h3',
      'h4', 'h5', 'h6', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'img',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'data-type', 'data-id',
      'src', 'alt', 'loading'],
  });

  // Spoiler tags: ||content|| → click-to-reveal span (on sanitized output)
  result = result.replace(
    /\|\|(.+?)\|\|/g,
    '<span class="spoiler">$1</span>',
  );

  // User mentions: <@userId> → styled span (IDs are hex+hyphens only)
  result = result.replace(
    /&lt;@([a-f0-9-]+)&gt;/g,
    (_match, id: string) => {
      const name = resolver?.members?.get(id) ?? 'Unknown';
      return `<span class="mention" data-type="user" data-id="${id}">@${escapeHtml(name)}</span>`;
    },
  );

  // Role mentions: <@&roleId>
  result = result.replace(
    /&lt;@&amp;([a-f0-9-]+)&gt;/g,
    '<span class="mention" data-type="role" data-id="$1">@role</span>',
  );

  // Channel mentions: <#channelId>
  result = result.replace(
    /&lt;#([a-f0-9-]+)&gt;/g,
    (_match, id: string) => {
      const name = resolver?.channels?.get(id) ?? 'channel';
      return `<span class="mention" data-type="channel" data-id="${id}">#${escapeHtml(name)}</span>`;
    },
  );

  return result;
}
