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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render a message string to sanitized HTML.
 * Supports: bold, italic, strikethrough, inline code, code blocks,
 * blockquotes, lists, links, spoilers, and mentions.
 */
export function renderMarkdown(content: string): string {
  if (!content) return '';

  const html = marked.parse(content, { renderer, async: false }) as string;

  // Post-process: apply custom syntax on the already-sanitized HTML
  let result = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'a', 'strong', 'em', 'del', 'code', 'pre', 'blockquote',
      'ul', 'ol', 'li', 'br', 'p', 'span', 'h1', 'h2', 'h3',
      'h4', 'h5', 'h6', 'hr',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'data-type', 'data-id'],
  });

  // Spoiler tags: ||content|| → click-to-reveal span (on sanitized output)
  result = result.replace(
    /\|\|(.+?)\|\|/g,
    '<span class="spoiler">$1</span>',
  );

  // User mentions: <@userId> → styled span (IDs are hex+hyphens only)
  result = result.replace(
    /&lt;@([a-f0-9-]+)&gt;/g,
    '<span class="mention" data-type="user" data-id="$1">@user</span>',
  );

  // Role mentions: <@&roleId>
  result = result.replace(
    /&lt;@&amp;([a-f0-9-]+)&gt;/g,
    '<span class="mention" data-type="role" data-id="$1">@role</span>',
  );

  // Channel mentions: <#channelId>
  result = result.replace(
    /&lt;#([a-f0-9-]+)&gt;/g,
    '<span class="mention" data-type="channel" data-id="$1">#channel</span>',
  );

  return result;
}
