import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from 'react';

import { Send, Paperclip, Smile, Maximize2, Minimize2 } from 'lucide-react';

import { TextArea } from '@/ui';

import { connectionManager } from '@/services/connection-manager';
import { useUiStore } from '@/stores/ui';
import { useMarkdownShortcuts } from '@/hooks/useMarkdownShortcuts';

import { EmojiGifPicker } from '../shared/EmojiGifPicker';
import { MarkdownToolbar } from '../shared/MarkdownToolbar';

type ServerDmInputProps = {
  conversationId: string;
  peerName: string;
  onSend: (content: string, replyTo?: string, attachmentIds?: string[]) => Promise<void>;
  replyTo?: { id: string; author: string; content: string } | null;
  onCancelReply?: () => void;
  onExpandedChange?: (expanded: boolean) => void;
};

export function ServerDmInput({ conversationId, peerName, onSend, replyTo, onCancelReply, onExpandedChange }: ServerDmInputProps) {
  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const manualExpand = useRef(false);
  const prevHadNewline = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const smileButtonRef = useRef<HTMLButtonElement>(null);

  const { applyMarkdown, handleMarkdownKeyDown } = useMarkdownShortcuts(textareaRef, content, setContent);

  // Auto-expand/collapse based on newlines
  useEffect(() => {
    const hasNewline = content.includes('\n');
    if (hasNewline && !prevHadNewline.current) {
      setExpanded(true);
    } else if (!hasNewline && prevHadNewline.current && !manualExpand.current) {
      setExpanded(false);
    }
    prevHadNewline.current = hasNewline;
  }, [content]);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      manualExpand.current = !prev;
      return !prev;
    });
  }, []);

  // Notify parent of expansion changes
  const prevExpanded = useRef(expanded);
  if (prevExpanded.current !== expanded) {
    prevExpanded.current = expanded;
    onExpandedChange?.(expanded);
  }

  const handleSend = useCallback(() => {
    const text = content.trim();
    if (!text) return;
    onSend(text, replyTo?.id);
    setContent('');
    onCancelReply?.();
    setExpanded(false);
    manualExpand.current = false;
    prevHadNewline.current = false;
  }, [content, onSend, replyTo, onCancelReply]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (handleMarkdownKeyDown(e)) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    const serverId = useUiStore.getState().activeServerId;
    if (serverId) {
      connectionManager.getMainWs(serverId)?.sendServerDmTyping(conversationId);
    }
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const serverId = useUiStore.getState().activeServerId;
    if (!serverId) return;
    const conn = connectionManager.getServerConnection(serverId);
    if (!conn) return;

    setUploading(true);
    try {
      const attachmentIds: string[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${conn.address}/upload/dm`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${conn.token}` },
          body: formData,
        });

        if (!res.ok) throw new Error('Upload failed');
        const result = (await res.json()) as { id: string };
        attachmentIds.push(result.id);
      }

      if (attachmentIds.length > 0) {
        await onSend(content.trim(), replyTo?.id, attachmentIds);
        setContent('');
        onCancelReply?.();
      }
    } catch {
      // Upload failed silently
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [content, onSend, replyTo, onCancelReply]);

  const handleEmojiInsert = useCallback(
    (emoji: string) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        setContent((prev) => prev + emoji);
        return;
      }
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = content.slice(0, start);
      const after = content.slice(end);
      setContent(before + emoji + after);
      requestAnimationFrame(() => {
        const pos = start + emoji.length;
        textarea.selectionStart = pos;
        textarea.selectionEnd = pos;
        textarea.focus();
      });
    },
    [content],
  );

  const handleGifSend = useCallback(
    (url: string) => {
      onSend(url, replyTo?.id);
      onCancelReply?.();
      setPickerOpen(false);
    },
    [onSend, replyTo, onCancelReply],
  );

  const buttons = (
    <>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="text-muted hover:text-primary disabled:opacity-30 transition-colors p-1"
      >
        <Paperclip size={18} />
      </button>
      <button
        ref={smileButtonRef}
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        className="text-muted hover:text-primary transition-colors p-1"
      >
        <Smile size={18} />
      </button>
      <button
        type="button"
        onClick={toggleExpanded}
        className="text-muted hover:text-primary transition-colors p-1"
        title={expanded ? 'Collapse' : 'Expand'}
      >
        {expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>
      <button
        type="button"
        disabled={!content.trim()}
        onClick={handleSend}
        className="text-muted hover:text-primary disabled:opacity-30 transition-colors p-1"
      >
        <Send size={18} />
      </button>
    </>
  );

  const emojiPicker = pickerOpen && (
    <EmojiGifPicker
      mode="both"
      onEmojiSelect={handleEmojiInsert}
      onGifSelect={handleGifSend}
      onClose={() => setPickerOpen(false)}
      anchorRef={smileButtonRef}
    />
  );

  const hiddenFileInput = (
    <input
      ref={fileInputRef}
      type="file"
      multiple
      className="hidden"
      onChange={handleFileSelect}
    />
  );

  if (expanded) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        {emojiPicker}
        {hiddenFileInput}

        <MarkdownToolbar visible onAction={applyMarkdown} />

        <div className="flex-1 overflow-auto px-2 pt-2">
          <TextArea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={uploading ? 'Uploading...' : `Message @${peerName}`}
            maxRows={8}
            fillParent
            className="border-0 focus:ring-0 bg-transparent"
            disabled={uploading}
          />
        </div>

        <div className="flex items-center justify-end gap-1 px-2 py-1 shrink-0">
          {buttons}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center flex-1 overflow-hidden">
      {emojiPicker}
      {hiddenFileInput}

      <div className="flex-1 min-w-0 px-2">
        <TextArea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={uploading ? 'Uploading...' : `Message @${peerName}`}
          maxRows={8}
          className="border-0 focus:ring-0 bg-transparent"
          disabled={uploading}
        />
      </div>

      <div className="flex items-center gap-1 pr-2 shrink-0">
        {buttons}
      </div>
    </div>
  );
}
