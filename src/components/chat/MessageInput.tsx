import { useState, useRef, useCallback, useMemo, useEffect, type KeyboardEvent } from 'react';
import { connectionManager } from '../../services/connection-manager.js';
import { useMemberStore } from '../../stores/member.js';
import { useChannelStore } from '../../stores/channel.js';
import type { Member, Channel } from 'ecto-shared';

interface MessageInputProps {
  channelId: string;
  serverId: string;
  onSend: (content: string, replyTo?: string, attachmentIds?: string[]) => Promise<void>;
  replyTo?: { id: string; author: string; content: string } | null;
  onCancelReply?: () => void;
}

interface AutocompleteState {
  type: '@' | '#';
  query: string;
  startIndex: number;
}

function detectAutocomplete(text: string, cursorPos: number): AutocompleteState | null {
  // Scan backwards from cursor to find a trigger character (@ or #)
  for (let i = cursorPos - 1; i >= 0; i--) {
    const ch = text[i];
    // Space means no active trigger in this word
    if (ch === ' ' || ch === '\n') return null;
    if (ch === '@' || ch === '#') {
      // Trigger must be at start of text or preceded by whitespace
      if (i === 0 || text[i - 1] === ' ' || text[i - 1] === '\n') {
        return {
          type: ch as '@' | '#',
          query: text.slice(i + 1, cursorPos),
          startIndex: i,
        };
      }
      return null;
    }
  }
  return null;
}

export function MessageInput({ channelId, serverId, onSend, replyTo, onCancelReply }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [autocomplete, setAutocomplete] = useState<AutocompleteState | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const serverMembers = useMemberStore((s) => s.members.get(serverId));
  const serverChannels = useChannelStore((s) => s.channels.get(serverId));

  const filteredItems = useMemo(() => {
    if (!autocomplete) return [];
    const q = autocomplete.query.toLowerCase();

    if (autocomplete.type === '@') {
      if (!serverMembers) return [];
      const results: Member[] = [];
      for (const member of serverMembers.values()) {
        const match =
          member.display_name?.toLowerCase().includes(q) ||
          member.nickname?.toLowerCase().includes(q) ||
          member.username.toLowerCase().includes(q);
        if (match) {
          results.push(member);
          if (results.length >= 8) break;
        }
      }
      return results;
    }

    // # trigger — text channels
    if (!serverChannels) return [];
    const results: Channel[] = [];
    for (const ch of serverChannels.values()) {
      if (ch.type === 'text' && ch.name.toLowerCase().includes(q)) {
        results.push(ch);
        if (results.length >= 8) break;
      }
    }
    return results;
  }, [autocomplete, serverMembers, serverChannels]);

  // Reset selectedIndex when the list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  const selectItem = useCallback(
    (item: Member | Channel) => {
      if (!autocomplete || !textareaRef.current) return;

      const replacement =
        autocomplete.type === '@'
          ? `<@${(item as Member).user_id}> `
          : `<#${item.id}> `;

      const before = content.slice(0, autocomplete.startIndex);
      const after = content.slice(textareaRef.current.selectionStart);
      const newContent = before + replacement + after;

      setContent(newContent);
      setAutocomplete(null);

      // Restore cursor position after React re-render
      const cursorPos = before.length + replacement.length;
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(cursorPos, cursorPos);
        }
      });
    },
    [autocomplete, content],
  );

  const handleSend = useCallback(async () => {
    const text = content.trim();
    if (!text && !replyTo) return;

    // Send typing.stop immediately so other users see indicator disappear
    const ws = connectionManager.getMainWs(serverId);
    ws?.send('typing.stop', { channel_id: channelId });

    try {
      await onSend(text, replyTo?.id);
      setContent('');
      setAutocomplete(null);
      onCancelReply?.();
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch {
      // Error handling done in hook
    }
  }, [content, replyTo, onSend, onCancelReply, channelId, serverId]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setContent(newValue);

    const cursorPos = e.target.selectionStart;
    setAutocomplete(detectAutocomplete(newValue, cursorPos));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Autocomplete keyboard handling
    if (autocomplete && filteredItems.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev <= 0 ? filteredItems.length - 1 : prev - 1));
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev >= filteredItems.length - 1 ? 0 : prev + 1));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const item = filteredItems[selectedIndex];
        if (item) selectItem(item);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAutocomplete(null);
        return;
      }
    }

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

      {autocomplete && filteredItems.length > 0 && (
        <div className="mention-autocomplete">
          {filteredItems.map((item, i) =>
            autocomplete.type === '@' ? (
              <div
                key={(item as Member).user_id}
                className={`mention-autocomplete-item${i === selectedIndex ? ' active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectItem(item);
                }}
              >
                {(item as Member).avatar_url ? (
                  <img
                    src={(item as Member).avatar_url!}
                    alt=""
                    style={{ width: 20, height: 20, borderRadius: '50%' }}
                  />
                ) : (
                  <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'inline-block' }} />
                )}
                <span>
                  {(item as Member).nickname ?? (item as Member).display_name ?? (item as Member).username}
                </span>
              </div>
            ) : (
              <div
                key={item.id}
                className={`mention-autocomplete-item${i === selectedIndex ? ' active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectItem(item);
                }}
              >
                <span style={{ opacity: 0.5 }}>#</span>
                <span>{(item as Channel).name}</span>
              </div>
            ),
          )}
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
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={`Message #channel`}
          rows={1}
        />
      </div>
    </div>
  );
}
