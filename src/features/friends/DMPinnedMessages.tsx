import { useState, useEffect, useCallback } from 'react';

import { Pin } from 'lucide-react';

import { Modal, Spinner, EmptyState, ScrollArea } from '@/ui';

import { connectionManager } from '@/services/connection-manager';

import type { Message } from 'ecto-shared';

import { MessageItem } from '@/features/chat';

import { dmToMessage } from './dm-utils';

type DMPinnedMessagesProps = {
  userId: string;
  open: boolean;
  onClose: () => void;
};

export function DMPinnedMessages({ userId, open, onClose }: DMPinnedMessagesProps) {
  const [pins, setPins] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPins = useCallback(async () => {
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;
    setLoading(true);
    try {
      const pinned = await centralTrpc.dms.listPinned.query({ user_id: userId });
      setPins(pinned.map(dmToMessage));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open) loadPins();
  }, [open, loadPins]);

  const noop = async () => {};

  return (
    <Modal
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      title="Pinned Messages"
      width="lg"
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : pins.length === 0 ? (
        <EmptyState
          icon={<Pin />}
          title="No pinned messages"
          description="Pin important messages so they're easy to find later."
        />
      ) : (
        <ScrollArea className="max-h-[60vh]">
          <div className="flex flex-col gap-1">
            {pins.map((msg) => (
              <MessageItem
                key={msg.id}
                message={msg}
                onEdit={noop}
                onDelete={noop}
                onReact={noop}
                onPin={noop}
                readOnly
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </Modal>
  );
}
