import { useState, useRef, useCallback, type KeyboardEvent } from 'react';

import { Send, Paperclip } from 'lucide-react';

import { TextArea } from '@/ui';

import { connectionManager } from '@/services/connection-manager';
import { useAuthStore } from '@/stores/auth';

import type { Attachment } from 'ecto-shared';


type DMMessageInputProps = {
  userId: string;
  username: string;
  onSend: (content: string, attachments?: Attachment[]) => Promise<void>;
};

export function DMMessageInput({ userId, username, onSend }: DMMessageInputProps) {
  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    connectionManager.getCentralWs()?.sendDmTyping(userId);
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const { centralUrl, token } = useAuthStore.getState();
    if (!token || !centralUrl) return;

    setUploading(true);
    try {
      const attachments: Attachment[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${centralUrl}/upload/dm`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!res.ok) throw new Error('Upload failed');
        const result = await res.json() as Attachment;
        attachments.push(result);
      }

      if (attachments.length > 0) {
        await onSend(content.trim(), attachments);
        setContent('');
      }
    } catch {
      // Upload failed silently
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [content, onSend]);

  return (
    <div className="p-3">
      <div className="relative">
        <TextArea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={uploading ? 'Uploading...' : `Message @${username}`}
          maxRows={8}
          className="pr-22"
          disabled={uploading}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
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
            disabled={!content.trim()}
            onClick={handleSend}
            className="text-muted hover:text-primary disabled:opacity-30 transition-colors p-1"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
