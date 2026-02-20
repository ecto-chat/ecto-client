import { useCallback } from 'react';

import { useServerStore } from '@/stores/server';

import { connectionManager } from '@/services/connection-manager';

import { flattenTemplateChannels } from '@/lib/server-templates';

import type { ServerTemplate } from '@/lib/server-templates';

import { useWizardState } from './useWizardState';

export function useWizardActions(serverId: string | null, onClose: () => void) {
  const wizardState = useWizardState(serverId);
  const { state, setLoading, setError, updateState, goNext } = wizardState;

  const handleSelectTemplate = useCallback((template: ServerTemplate | null) => {
    if (template) {
      updateState({ selectedTemplate: template, channels: flattenTemplateChannels(template) });
    } else {
      updateState({
        selectedTemplate: null,
        channels: [{ name: 'general', type: 'text' }, { name: 'General', type: 'voice' }],
      });
    }
    goNext();
  }, [updateState, goNext]);

  const handleCreateChannels = useCallback(async () => {
    if (!serverId) return;
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    const template = state.selectedTemplate;
    const validChannels = state.channels.filter((c) => c.name.trim());
    if (validChannels.length === 0 && (!template || template.categories.length === 0)) {
      setError('At least one channel is required'); return;
    }
    setLoading(true); setError('');
    try {
      if (template && template.categories.length > 0) {
        for (const cat of template.categories) {
          const category = await trpc.categories.create.mutate({ name: cat.name });
          for (const ch of cat.channels) {
            await trpc.channels.create.mutate({
              name: ch.name.trim(), type: ch.type, category_id: category.id,
            });
          }
        }
        for (const ch of template.uncategorized) {
          await trpc.channels.create.mutate({ name: ch.name.trim(), type: ch.type });
        }
      } else {
        for (const channel of validChannels) {
          await trpc.channels.create.mutate({ name: channel.name.trim(), type: channel.type });
        }
      }
      if (template && template.roles.length > 0) {
        for (const role of template.roles) {
          await trpc.roles.create.mutate({ name: role.name, color: role.color });
        }
      }
      updateState({ channelsCreated: true });
      goNext();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create channels');
    } finally { setLoading(false); }
  }, [serverId, state.selectedTemplate, state.channels, updateState, goNext, setLoading, setError]);

  const handleCreateInvite = useCallback(async () => {
    if (!serverId) return;
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    setLoading(true); setError('');
    try {
      const result = await trpc.invites.create.mutate({});
      updateState({ invite: result.invite, inviteUrl: result.url });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create invite');
    } finally { setLoading(false); }
  }, [serverId, updateState, setLoading, setError]);

  const handleCopyInvite = useCallback(async () => {
    if (!state.inviteUrl) return;
    try { await navigator.clipboard.writeText(state.inviteUrl); } catch {
      const input = document.createElement('input');
      input.value = state.inviteUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
  }, [state.inviteUrl]);

  const handleFinish = useCallback(() => {
    if (serverId) {
      const trpc = connectionManager.getServerTrpc(serverId);
      if (trpc) { trpc.serverConfig.completeSetup.mutate().catch((err: unknown) => {
        console.warn('[setup] Failed to complete setup:', err);
      }); }
      const meta = useServerStore.getState().serverMeta.get(serverId);
      if (meta) {
        useServerStore.getState().setServerMeta(serverId, { ...meta, setup_completed: true });
      }
    }
    onClose();
  }, [serverId, onClose]);

  return {
    ...wizardState,
    handleSelectTemplate,
    handleCreateChannels,
    handleCreateInvite,
    handleCopyInvite,
    handleFinish,
  };
}
