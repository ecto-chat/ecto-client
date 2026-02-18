import { AnimatePresence } from 'motion/react';
import { Plus, CornerDownRight, X } from 'lucide-react';

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
  } = useMessageInput({ channelId, serverId, onSend, replyTo, onCancelReply });

  return (
    <div className="relative">
      {replyTo && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-tertiary border-b border-border text-sm text-secondary">
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

      <div className="flex items-end gap-2 p-3">
        <IconButton
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          tooltip="Attach file"
        >
          <Plus size={18} />
        </IconButton>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <div className="flex-1 min-w-0">
          <TextArea
            ref={textareaRef}
            className="min-h-[36px] max-h-[200px]"
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Message #channel"
            maxRows={10}
          />
        </div>
      </div>
    </div>
  );
}
