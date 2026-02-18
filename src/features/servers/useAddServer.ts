import { useState, useCallback } from 'react';

import { EctoErrorCode } from 'ecto-shared';

import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';
import { connectionManager } from '@/services/connection-manager';

import type { LocalJoinStage, ServerPreviewData } from './types';
import {
  getLocalCredentials, detectUsername, queryServerName,
  addToServerStore, fetchServerPreview,
} from './server-join-utils';

export function useAddServer() {
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [stage, setStage] = useState<LocalJoinStage>('idle');
  const [preview, setPreview] = useState<ServerPreviewData | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [detectedUser, setDetectedUser] = useState('');

  const resetAndClose = useCallback(() => {
    setAddress('');
    setError('');
    setStage('idle');
    setPreview(null);
    setNeedsPassword(false);
    setDetectedUser('');
    useUiStore.getState().closeModal();
  }, []);

  const attemptAutoJoin = useCallback(async (
    addr: string, username: string, password: string, invite?: string,
  ) => {
    setStage('joining');
    setError('');
    const result = await connectionManager.attemptLocalJoin(addr, {
      username, password, inviteCode: invite || undefined,
    });
    if ('serverId' in result) {
      await connectionManager.storeLocalCredentials(username, password);
      const name = await queryServerName(result.serverId, preview?.name ?? addr);
      addToServerStore(result.serverId, addr, name, preview?.icon_url ?? null);
      resetAndClose();
      return;
    }
    const { ectoCode, message } = result.error;
    if (ectoCode === EctoErrorCode.LOCAL_AUTH_DISABLED) {
      setStage('no-local-accounts');
    } else if (
      ectoCode === EctoErrorCode.INVITE_INVALID ||
      ectoCode === EctoErrorCode.INVITE_EXPIRED ||
      ectoCode === EctoErrorCode.INVITE_MAX_USES
    ) {
      setStage('preview');
      setError(message);
    } else {
      setStage('idle');
      setError(message);
    }
  }, [preview, resetAndClose]);

  const handleAddressSubmit = useCallback(async (addr: string) => {
    setAddress(addr);
    setError('');
    const isCentral = useAuthStore.getState().centralAuthState === 'authenticated';
    const token = useAuthStore.getState().getToken();
    if (isCentral && token) {
      const id = await connectionManager.connectToServer(addr, addr, token);
      const ct = connectionManager.getCentralTrpc();
      if (ct) await ct.servers.add.mutate({ server_address: addr }).catch(() => {});
      const name = await queryServerName(id, addr);
      addToServerStore(id, addr, name, null);
      resetAndClose();
      return;
    }
    const prev = await fetchServerPreview(addr);
    setPreview(prev);
    if (!prev.allow_local_accounts) { setStage('no-local-accounts'); return; }
    const creds = await getLocalCredentials();
    if (!creds) {
      const u = detectUsername();
      if (u) {
        setDetectedUser(u);
        setNeedsPassword(true);
        if (prev.require_invite) setStage('preview');
      } else {
        setError('No stored credentials. Please join a server through Direct Connect first.');
      }
      return;
    }
    if (prev.require_invite) { setStage('preview'); return; }
    await attemptAutoJoin(addr, creds.username, creds.password);
  }, [attemptAutoJoin, resetAndClose]);

  const handleInviteSubmit = useCallback(async (inviteCode: string, password?: string) => {
    if (needsPassword && password) {
      attemptAutoJoin(address, detectedUser, password, inviteCode);
      return;
    }
    const creds = await connectionManager.getStoredLocalCredentials();
    if (!creds) return;
    attemptAutoJoin(address, creds.username, creds.password, inviteCode);
  }, [address, attemptAutoJoin, detectedUser, needsPassword]);

  const handlePasswordSubmit = useCallback((password: string) => {
    attemptAutoJoin(address, detectedUser, password);
  }, [address, attemptAutoJoin, detectedUser]);

  return {
    stage, error, preview, needsPassword, detectedUser,
    resetAndClose, handleAddressSubmit, handleInviteSubmit, handlePasswordSubmit,
  };
}
