import { useState, useRef, useCallback } from 'react';
import { AnimatePresence } from 'motion/react';
import { Send, Paperclip, Smile, Maximize2, Minimize2 } from 'lucide-react';

import { TextArea } from '@/ui';

import { AutocompletePopup } from '../AutocompletePopup';
import { EmojiGifPicker } from '../../shared/EmojiGifPicker';
import { MarkdownToolbar } from '../../shared/MarkdownToolbar';
import { useMessageInput } from './useMessageInput';

type MessageInputProps = {
  channelId: string;
  serverId: string;
  onSend: (content: string, replyTo?: string, attachmentIds?: string[]) => Promise<void>;
  replyTo?: { id: string; author: string; content: string } | null;
  onCancelReply?: () => void;
  onExpandedChange?: (expanded: boolean) => void;
};

export function MessageInput({ channelId, serverId, onSend, replyTo, onCancelReply, onExpandedChange }: MessageInputProps) {
  const {
    content,
    setContent,
    uploading,
    autocomplete,
    selectedIndex,
    filteredItems,
    textareaRef,
    fileInputRef,
    selectItem,
    handleChange,
    handleKeyDown,
    handleInput,
    handleFileSelect,
    handleSend,
    slowmodeDisabled,
    slowmodeRemaining,
    expanded,
    toggleExpanded,
    applyMarkdown,
  } = useMessageInput({ channelId, serverId, onSend, replyTo, onCancelReply });

  const [pickerOpen, setPickerOpen] = useState(false);
  const smileButtonRef = useRef<HTMLButtonElement>(null);

  // Notify parent of expansion changes
  const prevExpanded = useRef(expanded);
  if (prevExpanded.current !== expanded) {
    prevExpanded.current = expanded;
    onExpandedChange?.(expanded);
  }

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
      const newContent = before + emoji + after;
      setContent(newContent);
      requestAnimationFrame(() => {
        const pos = start + emoji.length;
        textarea.selectionStart = pos;
        textarea.selectionEnd = pos;
        textarea.focus();
      });
    },
    [content, setContent, textareaRef],
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
        disabled={!content.trim() || slowmodeDisabled}
        onClick={handleSend}
        className="text-muted hover:text-primary disabled:opacity-30 transition-colors p-1"
      >
        <Send size={18} />
      </button>
    </>
  );

  const autocompletePopup = (
    <div className="relative shrink-0">
      <AnimatePresence>
        {autocomplete && filteredItems.length > 0 && (
          <AutocompletePopup
            autocomplete={autocomplete}
            items={filteredItems}
            selectedIndex={selectedIndex}
            onSelect={selectItem}
          />
        )}
      </AnimatePresence>
    </div>
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
        {autocompletePopup}
        {emojiPicker}
        {hiddenFileInput}

        <MarkdownToolbar visible onAction={applyMarkdown} />

        <div className="flex-1 overflow-auto px-2 pt-2">
          <TextArea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={slowmodeDisabled ? `Slowmode: ${slowmodeRemaining}s` : 'Message #channel'}
            maxRows={10}
            fillParent
            disabled={slowmodeDisabled || uploading}
            className="border-0 focus:ring-0 bg-transparent"
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
      {autocompletePopup}
      {emojiPicker}
      {hiddenFileInput}

      <div className="flex-1 min-w-0 px-2">
        <TextArea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={slowmodeDisabled ? `Slowmode: ${slowmodeRemaining}s` : 'Message #channel'}
          maxRows={10}
          disabled={slowmodeDisabled || uploading}
          className="border-0 focus:ring-0 bg-transparent"
        />
      </div>

      <div className="flex items-center gap-1 pr-2 shrink-0">
        {buttons}
      </div>
    </div>
  );
}
