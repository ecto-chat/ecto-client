import { useState, useCallback } from 'react';
import { Avatar } from '../common/Avatar.js';
import { useAuthStore } from '../../stores/auth.js';
import { useUiStore } from '../../stores/ui.js';
import { connectionManager } from '../../services/connection-manager.js';
import { renderMarkdown } from '../../lib/markdown.js';
import { LinkPreviews } from './LinkPreview.js';
import type { Message } from 'ecto-shared';

const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.msi', '.bat', '.cmd', '.scr', '.ps1', '.sh', '.jar', '.app', '.dmg',
  '.vbs', '.com', '.pif', '.reg',
]);

interface MessageItemProps {
  message: Message;
  onEdit: (messageId: string, content: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  onReact: (messageId: string, emoji: string) => Promise<void>;
  onPin: (messageId: string) => Promise<void>;
  readOnly?: boolean;
  reactOnly?: boolean;
}

function resolveFileUrl(relativeUrl: string): string {
  if (relativeUrl.startsWith('http')) return relativeUrl;
  const serverId = useUiStore.getState().activeServerId;
  if (!serverId) return relativeUrl;
  const conn = connectionManager.getServerConnection(serverId);
  if (!conn) return relativeUrl;
  return `${conn.address}${relativeUrl}`;
}

export function MessageItem({ message, onEdit, onDelete, onReact, onPin, readOnly, reactOnly }: MessageItemProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content ?? '');
  const [hovering, setHovering] = useState(false);
  const [fileWarning, setFileWarning] = useState<{ url: string; filename: string } | null>(null);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const activeServerId = useUiStore((s) => s.activeServerId);
  const isOwn = message.author?.id === currentUserId;

  const handleAuthorClick = () => {
    if (!message.author?.id || !activeServerId) return;
    useUiStore.getState().openModal('user-profile', { userId: message.author.id, serverId: activeServerId });
  };

  const handleEditSubmit = useCallback(async () => {
    if (editContent && editContent.trim() && editContent !== message.content) {
      await onEdit(message.id, editContent.trim());
    }
    setEditing(false);
  }, [editContent, message.id, message.content, onEdit]);

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEditSubmit();
    } else if (e.key === 'Escape') {
      setEditing(false);
      setEditContent(message.content ?? '');
    }
  };

  const quickReactions = ['\u{1F44D}', '\u{1F44E}', '\u{1F602}', '\u{2764}\u{FE0F}', '\u{1F440}'];

  const timestamp = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  // System message rendering
  if (message.type !== undefined && message.type !== 0) {
    return (
      <div className="message-item system-message">
        <span className="system-message-text">{message.content}</span>
        <span className="message-timestamp">{timestamp}</span>
      </div>
    );
  }

  return (
    <div
      className={`message-item ${editing ? 'editing' : ''}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div onClick={handleAuthorClick} style={{ cursor: 'pointer', flexShrink: 0 }}>
        <Avatar
          src={message.author?.avatar_url}
          username={message.author?.username ?? 'Unknown'}
          size={40}
        />
      </div>

      <div className="message-body">
        <div className="message-header">
          <span className="message-author" onClick={handleAuthorClick} style={{ cursor: 'pointer' }}>{message.author?.display_name ?? message.author?.username ?? 'Unknown'}</span>
          <span className="message-timestamp">{timestamp}</span>
          {message.edited_at && <span className="message-edited">(edited)</span>}
          {message.pinned && <span className="message-pin-badge">pinned</span>}
        </div>

        {/* Reply reference */}
        {message.reply_to && (
          <div className="message-reply-ref">
            <span className="reply-arrow">&#8627;</span>
            <span className="reply-text">replying to a message</span>
          </div>
        )}

        {editing ? (
          <div className="message-edit-container">
            <textarea
              value={editContent ?? ''}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleEditKeyDown}
              autoFocus
              className="message-edit-input"
            />
            <div className="message-edit-hint">
              escape to <button onClick={() => { setEditing(false); setEditContent(message.content ?? ''); }}>cancel</button>
              {' \u2022 '}
              enter to <button onClick={handleEditSubmit}>save</button>
            </div>
          </div>
        ) : (
          <>
            <div
              className="message-content message-markdown"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content ?? '') }}
              onClick={(e) => {
                const el = e.target as HTMLElement;
                if (el.classList.contains('spoiler')) el.classList.toggle('revealed');
              }}
            />
            {message.content && <LinkPreviews content={message.content} />}
          </>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="message-attachments">
            {message.attachments.map((att) => {
              const ext = att.filename.slice(att.filename.lastIndexOf('.')).toLowerCase();
              const isDangerous = DANGEROUS_EXTENSIONS.has(ext);
              const fileUrl = resolveFileUrl(att.url);

              return (
                <div key={att.id} className="message-attachment">
                  {att.content_type?.startsWith('image/') ? (
                    <img src={fileUrl} alt={att.filename} className="attachment-image" />
                  ) : isDangerous ? (
                    <button
                      type="button"
                      className="attachment-file"
                      onClick={() => setFileWarning({ url: fileUrl, filename: att.filename })}
                    >
                      &#9888; {att.filename} ({formatBytes(att.size_bytes)})
                    </button>
                  ) : (
                    <a href={fileUrl} download={att.filename} className="attachment-file">
                      {att.filename} ({formatBytes(att.size_bytes)})
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* File download warning */}
        {fileWarning && (
          <div className="file-warning-overlay" onClick={() => setFileWarning(null)}>
            <div className="file-warning-card" onClick={(e) => e.stopPropagation()}>
              <div className="file-warning-icon">&#9888;</div>
              <h3>Potentially Dangerous File</h3>
              <div className="file-warning-filename">{fileWarning.filename}</div>
              <p>This file type could be harmful to your computer. Only download files from sources you trust.</p>
              <div className="file-warning-actions">
                <button className="btn-secondary" onClick={() => setFileWarning(null)}>Cancel</button>
                <a
                  href={fileWarning.url}
                  download={fileWarning.filename}
                  className="btn-danger"
                  onClick={() => setFileWarning(null)}
                >
                  Download Anyway
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="message-reactions">
            {message.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                className={`reaction-chip ${reaction.me ? 'active' : ''}`}
                onClick={() => onReact(message.id, reaction.emoji)}
              >
                <span>{reaction.emoji}</span>
                <span className="reaction-count">{reaction.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover toolbar */}
      {hovering && !editing && !readOnly && (
        <div className="message-toolbar">
          {quickReactions.map((emoji) => (
            <button key={emoji} className="toolbar-btn" onClick={() => onReact(message.id, emoji)} title="React">
              {emoji}
            </button>
          ))}
          {!reactOnly && (
            <button className="toolbar-btn" onClick={() => onPin(message.id)} title={message.pinned ? 'Unpin' : 'Pin'}>
              &#128204;
            </button>
          )}
          {isOwn && (
            <button className="toolbar-btn" onClick={() => { setEditing(true); setEditContent(message.content ?? ''); }} title="Edit">
              &#9998;
            </button>
          )}
          {!reactOnly && isOwn && (
            <button className="toolbar-btn danger" onClick={() => onDelete(message.id)} title="Delete">
              &#128465;
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
