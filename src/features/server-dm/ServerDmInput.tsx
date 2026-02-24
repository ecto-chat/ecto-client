import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { Send, CornerDownRight, X } from 'lucide-react';
import { TextArea, IconButton } from '@/ui';
import { connectionManager } from '@/services/connection-manager';
import { useUiStore } from '@/stores/ui';

type ServerDmInputProps = {
  conversationId: string;
  peerName: string;
  onSend: (content: string, replyTo?: string) => Promise<void>;
  replyTo?: { id: string; author: string; content: string } | null;
  onCancelReply?: () => void;
};

export function ServerDmInput({ conversationId, peerName, onSend, replyTo, onCancelReply }: ServerDmInputProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const text = content.trim();
    if (!text) return;
    onSend(text, replyTo?.id);
    setContent('');
    onCancelReply?.();
  }, [content, onSend, replyTo, onCancelReply]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    const serverId = useUiStore.getState().activeServerId;
    if (serverId) {
      connectionManager.getMainWs(serverId)?.sendServerDmTyping(conversationId);
    }
  };

  return (
    <div>
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
      <div className="flex items-end gap-2 p-3">
        <div className="flex-1 min-w-0">
          <TextArea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message @${peerName}`}
            maxRows={8}
          />
        </div>
        <IconButton
          variant="ghost"
          size="sm"
          tooltip="Send"
          disabled={!content.trim()}
          onClick={handleSend}
        >
          <Send size={18} />
        </IconButton>
      </div>
    </div>
  );
}
