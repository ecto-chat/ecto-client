import { useState } from 'react';
import { AlertTriangle, Settings } from 'lucide-react';
import { Permissions } from 'ecto-shared';
import { useUiStore } from '@/stores/ui';
import { useServerStore } from '@/stores/server';
import { usePermissions } from '@/hooks/usePermissions';
import { IconButton } from '@/ui/IconButton';
import { Modal, Button } from '@/ui';

export function ServerHeader() {
  const activeServerId = useUiStore((s) => s.activeServerId);
  const server = useServerStore((s) =>
    activeServerId ? s.servers.get(activeServerId) : undefined,
  );
  const meta = useServerStore((s) =>
    activeServerId ? s.serverMeta.get(activeServerId) : undefined,
  );
  const { canAccessSettings, isAdmin, effectivePermissions } = usePermissions(activeServerId);
  const canManageServer = isAdmin || (effectivePermissions & Permissions.MANAGE_SERVER) !== 0;

  const showPendingBadge = canManageServer && meta?.discoverable && !meta.discovery_approved;
  const [showPendingModal, setShowPendingModal] = useState(false);

  return (
    <div className="flex h-[60px] shrink-0 items-center justify-between px-4 border-b-3 border-primary">
      <div className="flex items-center min-w-0">
        {showPendingBadge && (
          <button
            onClick={() => setShowPendingModal(true)}
            className="relative flex items-center justify-center w-7 h-7 mr-1 shrink-0"
            title="Discovery pending approval"
          >
            <span
              className="absolute inset-0 rounded-full border-2 border-dashed border-amber-500"
              style={{ animation: 'spin 6s linear infinite' }}
            />
            <AlertTriangle size={14} className="text-amber-500" />
          </button>
        )}
        <h2 className="text-base font-semibold text-primary truncate">
          {server?.server_name ?? 'Server'}
        </h2>
      </div>
      {canAccessSettings && (
        <IconButton
          variant="ghost"
          size="sm"
          tooltip="Server Settings"
          onClick={() => useUiStore.getState().openModal('server-settings')}
        >
          <Settings size={16} />
        </IconButton>
      )}

      <Modal
        open={showPendingModal}
        onOpenChange={(v) => { if (!v) setShowPendingModal(false); }}
        title="Discovery Pending"
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            Your server has been submitted for discovery and is pending review.
            An Ecto admin will review your server and approve it for the discovery feed.
            Once approved, you can submit news posts to Ecto Discover.
          </p>
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setShowPendingModal(false)}>
              Got it
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
