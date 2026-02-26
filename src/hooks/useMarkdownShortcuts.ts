import { useCallback, type RefObject, type KeyboardEvent } from 'react';

export type MarkdownAction =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'code'
  | 'codeblock'
  | 'blockquote'
  | 'orderedList'
  | 'unorderedList'
  | 'link'
  | 'spoiler';

type MarkdownSyntax = {
  prefix: string;
  suffix: string;
  placeholder: string;
  block?: boolean;
};

const syntaxMap: Record<MarkdownAction, MarkdownSyntax> = {
  bold: { prefix: '**', suffix: '**', placeholder: 'bold text' },
  italic: { prefix: '*', suffix: '*', placeholder: 'italic text' },
  strikethrough: { prefix: '~~', suffix: '~~', placeholder: 'strikethrough text' },
  code: { prefix: '`', suffix: '`', placeholder: 'code' },
  codeblock: { prefix: '```\n', suffix: '\n```', placeholder: 'code block', block: true },
  blockquote: { prefix: '> ', suffix: '', placeholder: 'quote' },
  orderedList: { prefix: '1. ', suffix: '', placeholder: 'list item' },
  unorderedList: { prefix: '- ', suffix: '', placeholder: 'list item' },
  link: { prefix: '[', suffix: '](url)', placeholder: 'link text' },
  spoiler: { prefix: '||', suffix: '||', placeholder: 'spoiler text' },
};

export function useMarkdownShortcuts(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  content: string,
  setContent: (value: string | ((prev: string) => string)) => void,
) {
  const applyMarkdown = useCallback(
    (action: MarkdownAction) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const syntax = syntaxMap[action];
      if (!syntax) return;
      const { prefix, suffix, placeholder } = syntax;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = content.slice(start, end);
      const text = selected || placeholder;

      const before = content.slice(0, start);
      const after = content.slice(end);
      const newContent = before + prefix + text + suffix + after;
      setContent(newContent);

      // Position cursor to select the inserted text (or placeholder)
      requestAnimationFrame(() => {
        textarea.focus();
        const selectStart = start + prefix.length;
        const selectEnd = selectStart + text.length;
        textarea.selectionStart = selectStart;
        textarea.selectionEnd = selectEnd;
      });
    },
    [textareaRef, content, setContent],
  );

  const handleMarkdownKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>): boolean => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return false;

      if (e.key === 'b' && !e.shiftKey) {
        e.preventDefault();
        applyMarkdown('bold');
        return true;
      }
      if (e.key === 'i' && !e.shiftKey) {
        e.preventDefault();
        applyMarkdown('italic');
        return true;
      }
      if (e.key === 'e' && !e.shiftKey) {
        e.preventDefault();
        applyMarkdown('code');
        return true;
      }
      if (e.key === 'X' && e.shiftKey) {
        e.preventDefault();
        applyMarkdown('strikethrough');
        return true;
      }
      if (e.key === '>' && e.shiftKey) {
        e.preventDefault();
        applyMarkdown('blockquote');
        return true;
      }

      return false;
    },
    [applyMarkdown],
  );

  return { applyMarkdown, handleMarkdownKeyDown };
}
