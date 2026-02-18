import { useState, useCallback } from 'react';

import { useServerStore } from '@/stores/server';

import { connectionManager } from '@/services/connection-manager';

import type { WizardStep, WizardState } from './wizard-types';

const INITIAL_STATE: WizardState = {
  serverName: '',
  serverDescription: '',
  serverIconUrl: null,
  requireInvite: false,
  allowLocalAccounts: true,
  allowMemberDms: false,
  maxUploadSizeBytes: 5 * 1024 * 1024,
  selectedTemplate: null,
  channels: [
    { name: 'general', type: 'text' },
    { name: 'General', type: 'voice' },
  ],
  channelsCreated: false,
  invite: null,
  inviteUrl: null,
};

export function useWizardState(serverId: string | null) {
  const [step, setStep] = useState<WizardStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [state, setState] = useState<WizardState>(INITIAL_STATE);

  const updateState = useCallback((partial: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const goNext = useCallback(() => {
    if (step < 7) { setError(''); setStep((s) => (s + 1) as WizardStep); }
  }, [step]);

  const goBack = useCallback(() => {
    if (step > 1) { setError(''); setStep((s) => (s - 1) as WizardStep); }
  }, [step]);

  const handleIconUpload = useCallback(async (file: File) => {
    if (!serverId) return;
    const conn = connectionManager.getServerConnection(serverId);
    if (!conn) return;
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${conn.address}/upload/icon`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${conn.token}` },
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Upload failed' })) as { error?: string };
        throw new Error(data.error ?? 'Upload failed');
      }
      const data = await res.json() as { icon_url: string };
      updateState({ serverIconUrl: data.icon_url });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload icon');
    }
  }, [serverId, updateState]);

  const handleSaveIdentity = useCallback(async () => {
    if (!serverId) return;
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    if (!state.serverName.trim()) { setError('Server name is required'); return; }
    setLoading(true); setError('');
    try {
      await trpc.server.update.mutate({
        name: state.serverName.trim(),
        description: state.serverDescription.trim() || undefined,
      });
      useServerStore.getState().updateServer(serverId, {
        server_name: state.serverName.trim(),
      });
      goNext();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update server');
    } finally { setLoading(false); }
  }, [serverId, state.serverName, state.serverDescription, goNext]);

  const handleSaveSettings = useCallback(async () => {
    if (!serverId) return;
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    setLoading(true); setError('');
    try {
      await trpc.serverConfig.update.mutate({
        require_invite: state.requireInvite,
        allow_local_accounts: state.allowLocalAccounts,
        allow_member_dms: state.allowMemberDms,
        max_upload_size_bytes: state.maxUploadSizeBytes,
      });
      goNext();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally { setLoading(false); }
  }, [serverId, state.requireInvite, state.allowLocalAccounts, state.allowMemberDms, state.maxUploadSizeBytes, goNext]);

  return {
    step, state, loading, error,
    setLoading, setError,
    updateState, goNext, goBack,
    handleIconUpload, handleSaveIdentity, handleSaveSettings,
  };
}
