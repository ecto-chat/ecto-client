import { AnimatePresence, motion } from 'motion/react';
import { LogIn } from 'lucide-react';

import { Modal, Button, Spinner } from '@/ui';
import { useUiStore } from '@/stores/ui';

import { JoinMethodPicker } from './JoinMethodPicker';
import { InviteCodeForm } from './InviteCodeForm';
import { ServerPasswordPrompt } from './ServerPasswordPrompt';
import { ServerPreviewCard } from './ServerPreviewCard';
import { useAddServer } from './useAddServer';

export function AddServerModal() {
  const open = useUiStore((s) => s.activeModal === 'add-server');
  const {
    stage, error, preview, needsPassword, detectedUser,
    resetAndClose, handleAddressSubmit, handleInviteSubmit, handlePasswordSubmit,
  } = useAddServer();

  const title = stage === 'joining' ? 'Joining Server'
    : stage === 'no-local-accounts' ? 'Cannot Join'
    : stage === 'preview' ? 'Join Server'
    : needsPassword ? 'Join Server' : 'Add a Server';

  return (
    <Modal open={open} onOpenChange={(v) => { if (!v) resetAndClose(); }} title={title}>
      <AnimatePresence mode="wait">
        <motion.div
          key={stage + (needsPassword ? '-pw' : '')}
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
                <Button variant="secondary" onClick={resetAndClose}>Close</Button>
                <Button onClick={() => { resetAndClose(); useUiStore.getState().openModal('central-sign-in'); }}>
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
              onCancel={resetAndClose}
            />
          )}

          {stage === 'idle' && needsPassword && (
            <ServerPasswordPrompt
              preview={preview}
              detectedUsername={detectedUser}
              error={error}
              onSubmit={handlePasswordSubmit}
              onCancel={resetAndClose}
            />
          )}

          {stage === 'idle' && !needsPassword && (
            <JoinMethodPicker
              onSubmit={handleAddressSubmit}
              onCancel={resetAndClose}
              error={error}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </Modal>
  );
}
