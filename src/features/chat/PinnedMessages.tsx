import { useState, useEffect } from 'react';

import { motion } from 'motion/react';
import { Pin } from 'lucide-react';

import { Modal, Spinner, EmptyState, ScrollArea } from '@/ui';

import { useUiStore } from '@/stores/ui';

import { connectionManager } from '@/services/connection-manager';

import type { Message } from 'ecto-shared';

import { MessageItem } from './MessageItem';

type PinnedMessagesProps = {
  channelId: string;
  open: boolean;
  onClose: () => void;
};

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

  const noop = async () => {};

  return (
    <Modal open={open} onOpenChange={(v) => { if (!v) onClose(); }} title="Pinned Messages" width="lg">
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
            {pins.map((msg, i) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 + 0.02, duration: 0.2 }}>
                <MessageItem
                  message={msg}
                  onEdit={noop}
                  onDelete={noop}
                  onReact={noop}
                  onPin={noop}
                  readOnly
                />
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      )}
    </Modal>
  );
}
