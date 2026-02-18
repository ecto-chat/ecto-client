import { useCallback } from 'react';

import { motion } from 'motion/react';
import { Check, X } from 'lucide-react';

import { Avatar, Button, EmptyState, IconButton } from '@/ui';
import { useFriendStore } from '@/stores/friend';
import { connectionManager } from '@/services/connection-manager';

export function PendingRequests() {
  const pendingIncoming = useFriendStore((s) => s.pendingIncoming);
  const pendingOutgoing = useFriendStore((s) => s.pendingOutgoing);

  const handleAccept = useCallback(async (requestId: string) => {
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;
    await centralTrpc.friends.accept.mutate({ friendship_id: requestId });
    useFriendStore.getState().removeRequest(requestId);
  }, []);

  const handleDecline = useCallback(async (requestId: string) => {
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;
    await centralTrpc.friends.decline.mutate({ friendship_id: requestId });
    useFriendStore.getState().removeRequest(requestId);
  }, []);

  const handleCancel = useCallback(async (requestId: string) => {
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;
    await centralTrpc.friends.decline.mutate({ friendship_id: requestId });
    useFriendStore.getState().removeRequest(requestId);
  }, []);

  const incoming = [...pendingIncoming.values()];
  const outgoing = [...pendingOutgoing.values()];

  if (incoming.length === 0 && outgoing.length === 0) {
    return (
      <EmptyState
        title="No pending requests"
        description="Friend requests you send or receive will appear here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {incoming.length > 0 && (
        <section>
          <h3 className="uppercase tracking-wider text-xs text-muted font-semibold px-3 mb-2">
            Incoming &mdash; {incoming.length}
          </h3>
          <div>
            {incoming.map((req, i) => (
              <motion.div key={req.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 + 0.02, duration: 0.2 }} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-hover transition-colors">
                <Avatar src={req.from_avatar_url} username={req.from_username} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary truncate">{req.from_username}</p>
                  <p className="text-xs text-muted">Incoming Friend Request</p>
                </div>
                <div className="flex items-center gap-1">
                  <IconButton variant="ghost" size="sm" tooltip="Accept" onClick={() => handleAccept(req.id)}>
                    <Check size={16} />
                  </IconButton>
                  <IconButton variant="danger" size="sm" tooltip="Decline" onClick={() => handleDecline(req.id)}>
                    <X size={16} />
                  </IconButton>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {outgoing.length > 0 && (
        <section>
          <h3 className="uppercase tracking-wider text-xs text-muted font-semibold px-3 mb-2">
            Outgoing &mdash; {outgoing.length}
          </h3>
          <div>
            {outgoing.map((req, i) => (
              <motion.div key={req.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 + 0.02, duration: 0.2 }} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-hover transition-colors">
                <Avatar src={req.from_avatar_url} username={req.from_username} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary truncate">{req.from_username}</p>
                  <p className="text-xs text-muted">Outgoing Friend Request</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => handleCancel(req.id)}>
                  Cancel
                </Button>
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
