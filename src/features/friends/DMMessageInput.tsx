import { useState, useRef, useCallback, type KeyboardEvent } from 'react';

import { Send } from 'lucide-react';

import { TextArea, IconButton } from '@/ui';

import { connectionManager } from '@/services/connection-manager';

type DMMessageInputProps = {
  userId: string;
  username: string;
  onSend: (content: string) => Promise<void>;
};

export function DMMessageInput({ userId, username, onSend }: DMMessageInputProps) {
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
    // Send typing indicator
    connectionManager.getCentralWs()?.sendDmTyping(userId);
  };

  return (
    <div className="flex items-end gap-2 p-3">
      <div className="flex-1 min-w-0">
        <TextArea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message @${username}`}
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
