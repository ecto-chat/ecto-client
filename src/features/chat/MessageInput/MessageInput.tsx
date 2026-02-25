import { useState, useRef, useCallback } from 'react';
import { AnimatePresence } from 'motion/react';
import { Send, Paperclip, Smile, CornerDownRight, X } from 'lucide-react';

import { IconButton, TextArea } from '@/ui';

import { AutocompletePopup } from '../AutocompletePopup';
import { EmojiGifPicker } from '../EmojiGifPicker';
import { useMessageInput } from './useMessageInput';

type MessageInputProps = {
  channelId: string;
  serverId: string;
  onSend: (content: string, replyTo?: string, attachmentIds?: string[]) => Promise<void>;
  replyTo?: { id: string; author: string; content: string } | null;
  onCancelReply?: () => void;
};

export function MessageInput({ channelId, serverId, onSend, replyTo, onCancelReply }: MessageInputProps) {
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
  } = useMessageInput({ channelId, serverId, onSend, replyTo, onCancelReply });

  const [pickerOpen, setPickerOpen] = useState(false);
  const smileButtonRef = useRef<HTMLButtonElement>(null);

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
      // Restore cursor position after emoji
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

  return (
    <div className="relative">
      {replyTo && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-tertiary border-b-2 border-primary text-sm text-secondary">
          <CornerDownRight size={14} className="text-muted" />
          <span>
            Replying to <span className="font-medium text-primary">{replyTo.author}</span>
          </span>
          <IconButton
            variant="ghost"
            size="sm"
            onClick={onCancelReply}
            className="ml-auto"
            tooltip="Cancel reply"
          >
            <X size={14} />
          </IconButton>
        </div>
      )}

      <div className="relative">
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

      {pickerOpen && (
        <EmojiGifPicker
          mode="both"
          onEmojiSelect={handleEmojiInsert}
          onGifSelect={handleGifSend}
          onClose={() => setPickerOpen(false)}
          anchorRef={smileButtonRef}
        />
      )}

      <div className="p-3">
        <div className="relative">
          <TextArea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={slowmodeDisabled ? `Slowmode: ${slowmodeRemaining}s` : 'Message #channel'}
            maxRows={10}
            disabled={slowmodeDisabled || uploading}
            className="pr-22"
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <div className="absolute right-2 bottom-1.5 flex items-center gap-1">
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
              disabled={!content.trim() || slowmodeDisabled}
              onClick={handleSend}
              className="text-muted hover:text-primary disabled:opacity-30 transition-colors p-1"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
