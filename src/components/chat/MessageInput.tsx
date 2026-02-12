import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { connectionManager } from '../../services/connection-manager.js';

interface MessageInputProps {
  channelId: string;
  serverId: string;
  onSend: (content: string, replyTo?: string, attachmentIds?: string[]) => Promise<void>;
  replyTo?: { id: string; author: string; content: string } | null;
  onCancelReply?: () => void;
}

export function MessageInput({ channelId, serverId, onSend, replyTo, onCancelReply }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(async () => {
    const text = content.trim();
    if (!text && !replyTo) return;

    try {
      await onSend(text, replyTo?.id);
      setContent('');
      onCancelReply?.();
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch {
      // Error handling done in hook
    }
  }, [content, replyTo, onSend, onCancelReply]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }

    // Send typing indicator
    const ws = connectionManager.getMainWs(serverId);
    ws?.sendTyping(channelId);
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const conn = connectionManager.getServerConnection(serverId);
      if (!conn) return;

      const attachmentIds: string[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('channel_id', channelId);
        formData.append('file', file);

        const res = await fetch(`${conn.address}/upload`, {
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
      // Upload failed
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="message-input-container">
      {replyTo && (
        <div className="message-reply-bar">
          <span>
            Replying to <strong>{replyTo.author}</strong>
          </span>
          <button className="reply-cancel" onClick={onCancelReply}>
            &times;
          </button>
        </div>
      )}

      <div className="message-input-row">
        <button
          className="message-attach-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Attach file"
        >
          +
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        <textarea
          ref={textareaRef}
          className="message-input"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={`Message #channel`}
          rows={1}
        />
      </div>
    </div>
  );
}
