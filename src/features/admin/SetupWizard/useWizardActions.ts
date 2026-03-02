import { useCallback } from 'react';

import { useServerStore } from '@/stores/server';
import { useChannelStore } from '@/stores/channel';

import { connectionManager } from '@/services/connection-manager';

import type { ServerTemplate } from '@/lib/server-templates';

import { useWizardState } from './useWizardState';

export function useWizardActions(serverId: string | null, onClose: () => void) {
  const wizardState = useWizardState(serverId);
  const { state, setLoading, setError, updateState, goNext } = wizardState;

  const handleSelectTemplate = useCallback((template: ServerTemplate | null) => {
    if (template) {
      updateState({
        selectedTemplate: template,
        categories: template.categories.map((c) => ({
          name: c.name,
          channels: c.channels.map((ch) => ({ name: ch.name, type: ch.type })),
        })),
        channels: template.uncategorized.map((ch) => ({ name: ch.name, type: ch.type })),
        roles: template.roles.map((r) => ({ name: r.name, color: r.color })),
      });
    } else {
      updateState({
        selectedTemplate: null,
        categories: [],
        channels: [],
        roles: [],
      });
    }
    goNext();
  }, [updateState, goNext]);

  const handleCreateChannels = useCallback(async () => {
    if (!serverId) return;
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    const validChannels = state.channels.filter((c) => c.name.trim());
    const hasCategories = state.categories.some((cat) => cat.channels.some((ch) => ch.name.trim()));
    if (validChannels.length === 0 && !hasCategories) {
      // Check if existing channels cover everything — allow zero new creations
      const existingMap = useChannelStore.getState().channels.get(serverId);
      if (!existingMap || existingMap.size === 0) {
        setError('At least one channel is required'); return;
      }
    }
    setLoading(true); setError('');
    try {
      // Build set of existing channel keys to prevent duplicates
      const existingKeys = new Set<string>();
      const existingMap = useChannelStore.getState().channels.get(serverId);
      if (existingMap) {
        for (const ch of existingMap.values()) {
          existingKeys.add(`${ch.name.toLowerCase()}:${ch.type}`);
        }
      }

      // Create categories and their channels
      for (const cat of state.categories) {
        const validCatChannels = cat.channels.filter((ch) => ch.name.trim());
        if (!cat.name.trim() && validCatChannels.length === 0) continue;
        const category = await trpc.categories.create.mutate({ name: cat.name.trim() });
        for (const ch of validCatChannels) {
          const key = `${ch.name.trim().toLowerCase()}:${ch.type}`;
          if (existingKeys.has(key)) continue;
          await trpc.channels.create.mutate({
            name: ch.name.trim(), type: ch.type, category_id: category.id,
          });
          existingKeys.add(key);
        }
      }

      // Create uncategorized channels
      for (const ch of validChannels) {
        const key = `${ch.name.trim().toLowerCase()}:${ch.type}`;
        if (existingKeys.has(key)) continue;
        await trpc.channels.create.mutate({ name: ch.name.trim(), type: ch.type });
        existingKeys.add(key);
      }

      // Create roles
      for (const role of state.roles) {
        if (!role.name.trim()) continue;
        await trpc.roles.create.mutate({ name: role.name.trim(), color: role.color });
      }

      updateState({ channelsCreated: true });
      goNext();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create channels');
    } finally { setLoading(false); }
  }, [serverId, state.categories, state.channels, state.roles, updateState, goNext, setLoading, setError]);

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
