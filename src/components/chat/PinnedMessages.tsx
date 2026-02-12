import { useState, useEffect } from 'react';
import { MessageItem } from './MessageItem.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import { connectionManager } from '../../services/connection-manager.js';
import { useUiStore } from '../../stores/ui.js';
import type { Message } from 'ecto-shared';

interface PinnedMessagesProps {
  channelId: string;
  open: boolean;
  onClose: () => void;
}

export function PinnedMessages({ channelId, open, onClose }: PinnedMessagesProps) {
  const [pins, setPins] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const activeServerId = useUiStore((s) => s.activeServerId);

  useEffect(() => {
    if (!open || !activeServerId) return;
    setLoading(true);
    const trpc = connectionManager.getServerTrpc(activeServerId);
    if (!trpc) return;

    trpc.messages.list.query({ channel_id: channelId, pinned_only: true })
      .then((result) => setPins(result.messages))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, channelId, activeServerId]);

  if (!open) return null;

  const noop = async () => {};

  return (
    <div className="pinned-messages-panel">
      <div className="pinned-messages-header">
        <h3>Pinned Messages</h3>
        <button className="modal-close" onClick={onClose}>
          &times;
        </button>
      </div>

      <div className="pinned-messages-list">
        {loading ? (
          <div className="pinned-loading">
            <LoadingSpinner />
          </div>
        ) : pins.length === 0 ? (
          <div className="pinned-empty">No pinned messages in this channel.</div>
        ) : (
          pins.map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
              onEdit={noop}
              onDelete={noop}
              onReact={noop}
              onPin={noop}
            />
          ))
        )}
      </div>
    </div>
  );
}
