import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked for Discord-like markdown
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Chat renderer: strips raw HTML
const chatRenderer = new marked.Renderer();
chatRenderer.html = () => '';
chatRenderer.link = ({ href, text }) =>
  `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
chatRenderer.image = ({ href, text }) => {
  if (!href || !href.startsWith('https://')) return escapeHtml(text ?? '');
  return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text ?? '')}" class="inline-image" loading="lazy" />`;
};

// Page renderer: allows raw HTML through (DOMPurify still sanitizes)
const pageRenderer = new marked.Renderer();
pageRenderer.link = ({ href, text }) =>
  `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
pageRenderer.image = ({ href, text }) => {
  if (!href || !href.startsWith('https://')) return escapeHtml(text ?? '');
  return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text ?? '')}" class="inline-image" loading="lazy" />`;
};

// Restrict src attributes (block javascript:, data:, etc.)
DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  if (data.attrName === 'src') {
    if (node.tagName === 'IMG' && !data.attrValue.startsWith('https://')) {
      data.attrValue = '';
    }
    if (node.tagName === 'IFRAME') {
      // Only allow YouTube and Vimeo embeds
      const allowed =
        data.attrValue.startsWith('https://www.youtube-nocookie.com/embed/') ||
        data.attrValue.startsWith('https://player.vimeo.com/video/');
      if (!allowed) data.attrValue = '';
    }
  }
  // Sanitize style attributes: block dangerous CSS properties
  if (data.attrName === 'style') {
    data.attrValue = sanitizeStyle(data.attrValue);
  }
});

/** Allowlist of CSS properties safe for user-authored HTML. */
const ALLOWED_CSS_PROPS = new Set([
  // Layout
  'display', 'flex', 'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
  'justify-content', 'align-items', 'align-self', 'align-content', 'order', 'gap', 'row-gap', 'column-gap',
  'grid', 'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row', 'grid-gap',
  'grid-area', 'grid-template-areas',
  // Box model
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'box-sizing', 'overflow', 'overflow-x', 'overflow-y',
  // Typography
  'font-size', 'font-weight', 'font-style', 'font-family',
  'text-align', 'text-decoration', 'text-transform', 'letter-spacing', 'line-height',
  'white-space', 'word-break', 'word-wrap', 'overflow-wrap',
  'color', 'opacity',
  // Background & borders
  'background', 'background-color', 'background-image', 'background-size', 'background-position',
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-radius', 'border-color', 'border-width', 'border-style',
  'border-collapse',
  // Position & visibility
  'position', 'top', 'right', 'bottom', 'left',
  'float', 'clear', 'vertical-align',
  'visibility',
  // Other
  'list-style', 'list-style-type', 'cursor',
  'transition', 'transform',
  'object-fit', 'object-position',
  'aspect-ratio',
]);

function sanitizeStyle(style: string): string {
  return style
    .split(';')
    .map((decl) => decl.trim())
    .filter((decl) => {
      if (!decl) return false;
      const colonIdx = decl.indexOf(':');
      if (colonIdx < 0) return false;
      const prop = decl.slice(0, colonIdx).trim().toLowerCase();
      const value = decl.slice(colonIdx + 1).trim().toLowerCase();
      // Block any value containing url(), expression(), javascript:, etc.
      if (/url\s*\(|expression\s*\(|javascript:|vbscript:/i.test(value)) return false;
      return ALLOWED_CSS_PROPS.has(prop);
    })
    .join('; ');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface MentionResolver {
  /** Map of userId → display name for user mentions */
  members?: Map<string, string>;
  /** Map of channelId → channel name for channel mentions */
  channels?: Map<string, string>;
  /** Map of roleId → { name, color } for role mentions */
  roles?: Map<string, { name: string; color: string | null }>;
  /** Whether @everyone/@here should render as highlighted (sender had permission) */
  mentionEveryone?: boolean;
}

/** Chat-safe DOMPurify tag list (no raw HTML layout elements). */
const CHAT_ALLOWED_TAGS = [
  'a', 'strong', 'em', 'del', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li', 'br', 'p', 'span', 'h1', 'h2', 'h3',
  'h4', 'h5', 'h6', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img', 'iframe', 'div',
];

/** Page-safe DOMPurify tag list — includes layout elements like GitHub markdown. */
const PAGE_ALLOWED_TAGS = [
  ...CHAT_ALLOWED_TAGS,
  'section', 'article', 'aside', 'header', 'footer', 'nav', 'main', 'figure', 'figcaption',
  'details', 'summary', 'mark', 'abbr', 'sub', 'sup', 'ins', 'kbd', 'samp', 'var',
  'dl', 'dt', 'dd', 'caption', 'colgroup', 'col', 'picture', 'source',
  'ruby', 'rt', 'rp', 'bdi', 'bdo', 'wbr',
];

const ALLOWED_ATTR = [
  'href', 'target', 'rel', 'class', 'data-type', 'data-id',
  'data-channel', 'data-user',
  'src', 'alt', 'loading', 'width', 'height', 'frameborder',
  'allow', 'allowfullscreen', 'title', 'style',
  'align', 'valign', 'colspan', 'rowspan', 'scope',
  'open', 'id', 'role', 'aria-label', 'aria-hidden',
  'start', 'reversed', 'type', 'media', 'sizes', 'srcset',
];

export interface RenderOptions {
  /** Allow raw HTML through (for page content). Default: false (chat mode). */
  allowHtml?: boolean;
}

/**
 * Tags that marked treats as block-level HTML (stops markdown parsing inside them).
 * We swap these out with placeholders so markdown inside them still gets parsed.
 */
const BLOCK_TAG_RE = /^<(\/?)(div|section|article|aside|header|footer|nav|main|figure|figcaption|details|summary)(\b[^>]*)>\s*$/;

/**
 * In page mode, replace standalone HTML block tags with text placeholders so
 * marked parses the markdown between them normally. After marked runs we
 * swap the placeholders back to real HTML tags.
 */
function preprocessHtmlBlocks(content: string): { processed: string; placeholders: Map<string, string> } {
  const placeholders = new Map<string, string>();
  let counter = 0;
  const lines = content.split('\n');
  const out: string[] = [];

  for (const line of lines) {
    const m = line.match(BLOCK_TAG_RE);
    if (m) {
      const id = `HTMLPH${counter++}END`;
      placeholders.set(id, line.trim());
      out.push(id);
    } else {
      out.push(line);
    }
  }

  return { processed: out.join('\n'), placeholders };
}

function restoreHtmlBlocks(html: string, placeholders: Map<string, string>): string {
  let result = html;
  for (const [id, tag] of placeholders) {
    // Marked wraps standalone text in <p> tags — strip the wrapper
    result = result.replace(`<p>${id}</p>`, tag);
    result = result.replace(id, tag);
  }
  return result;
}

/**
 * Render a markdown string to sanitized HTML.
 * Supports: bold, italic, strikethrough, inline code, code blocks,
 * blockquotes, lists, links, spoilers, mentions, and video embeds.
 *
 * With `allowHtml: true` (page mode), raw HTML like divs, flexbox containers,
 * details/summary, etc. are preserved (still sanitized by DOMPurify).
 * Markdown inside HTML block elements is still parsed.
 */
export function renderMarkdown(content: string, resolver?: MentionResolver, options?: RenderOptions): string {
  if (!content) return '';

  const usePageMode = options?.allowHtml ?? false;
  const renderer = usePageMode ? pageRenderer : chatRenderer;

  let rawHtml: string;
  let placeholders: Map<string, string> | null = null;

  if (usePageMode) {
    const pp = preprocessHtmlBlocks(content);
    placeholders = pp.placeholders;
    rawHtml = marked.parse(pp.processed, { renderer, async: false }) as string;
    rawHtml = restoreHtmlBlocks(rawHtml, placeholders);
  } else {
    rawHtml = marked.parse(content, { renderer, async: false }) as string;
  }

  // Post-process: apply custom syntax on the already-sanitized HTML
  let result = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: usePageMode ? PAGE_ALLOWED_TAGS : CHAT_ALLOWED_TAGS,
    ALLOWED_ATTR,
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

  // Role mentions: <@&roleId> — resolve name and color from roles map
  result = result.replace(
    /&lt;@&amp;([a-f0-9-]+)&gt;/g,
    (_match, id: string) => {
      const role = resolver?.roles?.get(id);
      const name = role?.name ?? 'role';
      const style = role?.color ? ` style="color:${escapeHtml(role.color)};background:${escapeHtml(role.color)}20"` : '';
      return `<span class="mention" data-type="role" data-id="${id}"${style}>@${escapeHtml(name)}</span>`;
    },
  );

  // @everyone / @here — highlight only if the message flags indicate the sender had permission
  if (resolver?.mentionEveryone) {
    result = result.replace(
      /(?<!\w)@(everyone|here)(?!\w)/g,
      '<span class="mention" data-type="everyone">@$1</span>',
    );
  }

  // Channel mentions: <#channelId>
  result = result.replace(
    /&lt;#([a-f0-9-]+)&gt;/g,
    (_match, id: string) => {
      const name = resolver?.channels?.get(id) ?? 'channel';
      return `<span class="mention" data-type="channel" data-id="${id}">#${escapeHtml(name)}</span>`;
    },
  );

  // YouTube embeds: standalone links to YouTube videos → responsive iframe
  result = result.replace(
    /<a href="(https:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)[^"]*)"[^>]*>[^<]*<\/a>/g,
    (_match, _href: string, videoId: string) =>
      `<div class="video-embed" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;border-radius:8px;margin:8px 0"><iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(videoId)}" style="position:absolute;top:0;left:0;width:100%;height:100%" frameborder="0" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen title="YouTube video"></iframe></div>`,
  );

  // Vimeo embeds: standalone links to Vimeo videos → responsive iframe
  result = result.replace(
    /<a href="(https:\/\/(?:www\.)?vimeo\.com\/(\d+)[^"]*)"[^>]*>[^<]*<\/a>/g,
    (_match, _href: string, videoId: string) =>
      `<div class="video-embed" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;border-radius:8px;margin:8px 0"><iframe src="https://player.vimeo.com/video/${escapeHtml(videoId)}" style="position:absolute;top:0;left:0;width:100%;height:100%" frameborder="0" allow="autoplay;fullscreen;picture-in-picture" allowfullscreen title="Vimeo video"></iframe></div>`,
  );

  return result;
}
