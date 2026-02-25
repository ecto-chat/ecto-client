import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LogIn } from 'lucide-react';

import { Modal, Button, Spinner } from '@/ui';
import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';

import { JoinMethodPicker } from './JoinMethodPicker';
import { CreateServerForm } from './CreateServerForm';
import { InviteCodeForm } from './InviteCodeForm';
import { ServerPasswordPrompt } from './ServerPasswordPrompt';
import { ServerPreviewCard } from './ServerPreviewCard';
import { useAddServer } from './useAddServer';

type Tab = 'join' | 'create';

export function AddServerModal() {
  const open = useUiStore((s) => s.activeModal === 'add-server');
  const modalData = useUiStore((s) => s.modalData) as { initialAddress?: string } | null;
  const centralAuth = useAuthStore((s) => s.centralAuthState);
  const [tab, setTab] = useState<Tab>('join');

  const {
    address, stage, error, preview, needsPassword, needsInvite, detectedUser,
    resetAndClose, handleAddressSubmit, handleInviteSubmit, handleCentralInviteSubmit, handlePasswordSubmit,
  } = useAddServer();

  // Auto-submit when opened with an initial address from server link embed
  useEffect(() => {
    if (open && modalData?.initialAddress) {
      handleAddressSubmit(modalData.initialAddress);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    resetAndClose();
    setTab('join');
  };

  const canCreate = centralAuth === 'authenticated';
  const showTabs = canCreate && stage === 'idle' && !needsPassword && !needsInvite;

  const title = stage === 'joining' ? 'Joining Server'
    : stage === 'no-local-accounts' ? 'Cannot Join'
    : stage === 'preview' ? 'Join Server'
    : needsPassword ? 'Join Server'
    : needsInvite ? 'Join Server'
    : tab === 'create' && canCreate ? 'Create a Server'
    : 'Add a Server';

  return (
    <Modal open={open} onOpenChange={(v) => { if (!v) handleClose(); }} title={title}>
      {showTabs && (
        <div className="flex gap-1 mb-4 rounded-lg bg-surface-2 p-1">
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === 'join' ? 'bg-surface-3 text-foreground' : 'text-muted hover:text-foreground'
            }`}
            onClick={() => setTab('join')}
          >
            Join a Server
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === 'create' ? 'bg-surface-3 text-foreground' : 'text-muted hover:text-foreground'
            }`}
            onClick={() => setTab('create')}
          >
            Create a Server
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={stage + (needsPassword ? '-pw' : '') + (showTabs ? tab : '')}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          {stage === 'joining' && (
            <div className="flex flex-col items-center gap-3 py-4">
              {preview && (
                <ServerPreviewCard
                  name={preview.name}
                  iconUrl={preview.icon_url}
                  memberCount={preview.member_count}
                  onlineCount={preview.online_count}
                />
              )}
              <Spinner size="md" />
              <p className="text-sm text-muted">Joining...</p>
            </div>
          )}

          {stage === 'no-local-accounts' && (
            <div className="flex flex-col gap-4">
              {preview && (
                <ServerPreviewCard
                  name={preview.name}
                  iconUrl={preview.icon_url}
                  memberCount={preview.member_count}
                  onlineCount={preview.online_count}
                />
              )}
              <p className="text-sm text-danger">
                This server does not accept local accounts.
              </p>
              <div className="flex items-center justify-end gap-2">
                <Button variant="secondary" onClick={handleClose}>Close</Button>
                <Button onClick={() => { handleClose(); useUiStore.getState().openModal('central-sign-in'); }}>
                  <LogIn size={16} />
                  Sign In to Ecto
                </Button>
              </div>
            </div>
          )}

          {stage === 'preview' && (
            <InviteCodeForm
              preview={preview}
              needsPassword={needsPassword}
              detectedUsername={detectedUser}
              error={error}
              onSubmit={handleInviteSubmit}
              onCancel={handleClose}
            />
          )}

          {stage === 'idle' && needsPassword && (
            <ServerPasswordPrompt
              preview={preview}
              detectedUsername={detectedUser}
              error={error}
              onSubmit={handlePasswordSubmit}
              onCancel={handleClose}
            />
          )}

          {stage === 'idle' && !needsPassword && (tab === 'join' || needsInvite) && (
            <JoinMethodPicker
              onSubmit={handleAddressSubmit}
              onCancel={handleClose}
              error={error}
              needsInvite={needsInvite}
              onInviteSubmit={handleCentralInviteSubmit}
              initialAddress={address}
            />
          )}

          {stage === 'idle' && !needsPassword && tab === 'create' && canCreate && (
            <CreateServerForm onCancel={handleClose} />
          )}
        </motion.div>
      </AnimatePresence>
    </Modal>
  );
}
