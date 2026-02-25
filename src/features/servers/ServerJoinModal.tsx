import { useState, useEffect, useCallback } from 'react';
import { Users, Wifi } from 'lucide-react';

import { Modal, Avatar, Button, Spinner } from '@/ui';
import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';

import type { PendingJoin } from '@/hooks/useJoinParams';
import type { ServerPreviewData } from './types';
import { fetchServerPreview } from './server-join-utils';
import { useAddServer } from './useAddServer';

export function ServerJoinModal() {
  const open = useUiStore((s) => s.activeModal === 'server-join');
  const modalData = useUiStore((s) => s.modalData) as PendingJoin | null;

  const [preview, setPreview] = useState<ServerPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const {
    stage, error, needsInvite,
    resetAndClose, handleAddressSubmit, handleCentralInviteSubmit,
  } = useAddServer();

  const [inviteInput, setInviteInput] = useState('');

  const close = useCallback(() => {
    resetAndClose();
    setPreview(null);
    setLoading(true);
    setFetchError('');
    setInviteInput('');
  }, [resetAndClose]);

  // Fetch server preview when modal opens
  useEffect(() => {
    if (!open || !modalData?.address) return;
    setLoading(true);
    setFetchError('');
    setPreview(null);
    if (modalData.invite) setInviteInput(modalData.invite);

    fetchServerPreview(modalData.address)
      .then(setPreview)
      .catch(() => setFetchError('Could not reach server'))
      .finally(() => setLoading(false));
  }, [open, modalData?.address, modalData?.invite]);

  const handleJoin = () => {
    if (!modalData?.address) return;
    // If an invite code is needed and we have one, use invite flow
    if (needsInvite && inviteInput.trim()) {
      handleCentralInviteSubmit(inviteInput.trim());
      return;
    }
    handleAddressSubmit(modalData.address);
  };

  // After initial address submit, if server needs invite and we have one from URL, auto-submit it
  useEffect(() => {
    if (needsInvite && modalData?.invite) {
      handleCentralInviteSubmit(modalData.invite);
    }
  }, [needsInvite]); // eslint-disable-line react-hooks/exhaustive-deps

  const isJoining = stage === 'joining';
  const isCentral = useAuthStore((s) => s.centralAuthState === 'authenticated');

  return (
    <Modal
      open={open}
      onOpenChange={(v) => { if (!v) close(); }}
      title="Join Server"
      width="sm"
    >
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner size="lg" />
        </div>
      ) : fetchError ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-danger">{fetchError}</p>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={close}>Close</Button>
          </div>
        </div>
      ) : preview ? (
        <div className="flex flex-col gap-4">
          {/* Banner + icon */}
          <div className="relative -mx-5 -mt-5">
            {preview.banner_url ? (
              <img
                src={preview.banner_url}
                alt=""
                className="h-28 w-full object-cover"
              />
            ) : (
              <div className="h-28 w-full bg-gradient-to-br from-indigo-600 to-purple-700" />
            )}
            <div className="absolute -bottom-6 left-5">
              <div className="rounded-xl border-4 border-secondary">
                <Avatar src={preview.icon_url} username={preview.name} size={48} />
              </div>
            </div>
          </div>

          {/* Server info */}
          <div className="mt-4 flex flex-col gap-1">
            <h3 className="text-lg font-semibold text-primary">{preview.name}</h3>
            <div className="flex items-center gap-4 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <Wifi size={12} />
                {preview.online_count} Online
              </span>
              <span className="inline-flex items-center gap-1">
                <Users size={12} />
                {preview.member_count} Members
              </span>
            </div>
          </div>

          {/* Invite code input — shown when server requires invite and no code was provided */}
          {(needsInvite || (preview.require_invite && !modalData?.invite)) && !isJoining && (
            <div className="flex flex-col gap-2">
              <label htmlFor="invite-code" className="text-sm text-secondary">
                This server requires an invite code
              </label>
              <input
                id="invite-code"
                type="text"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                placeholder="Enter invite code"
                className="rounded-md border-2 border-primary bg-tertiary px-3 py-2 text-sm text-primary placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          {stage === 'no-local-accounts' && !isCentral && (
            <p className="text-sm text-danger">
              This server does not accept local accounts. Please sign in to Ecto first.
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            {stage === 'no-local-accounts' && !isCentral ? (
              <Button onClick={() => { close(); useUiStore.getState().openModal('central-sign-in'); }}>
                Sign In to Ecto
              </Button>
            ) : (
              <Button
                onClick={handleJoin}
                loading={isJoining}
                disabled={preview.require_invite && !modalData?.invite && !inviteInput.trim()}
              >
                Join Server
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
