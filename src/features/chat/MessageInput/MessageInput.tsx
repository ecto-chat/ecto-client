import { AnimatePresence } from 'motion/react';
import { Send, Paperclip, CornerDownRight, X } from 'lucide-react';

import { IconButton, TextArea } from '@/ui';

import { AutocompletePopup } from '../AutocompletePopup';
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
