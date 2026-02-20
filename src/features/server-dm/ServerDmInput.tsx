import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { TextArea, IconButton } from '@/ui';
import { connectionManager } from '@/services/connection-manager';
import { useUiStore } from '@/stores/ui';

type ServerDmInputProps = {
  conversationId: string;
  peerName: string;
  onSend: (content: string) => Promise<void>;
};

export function ServerDmInput({ conversationId, peerName, onSend }: ServerDmInputProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const text = content.trim();
    if (!text) return;
    onSend(text);
    setContent('');
  }, [content, onSend]);

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
  );
}
