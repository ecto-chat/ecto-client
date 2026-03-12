import { useEffect } from 'react';
import { connectionManager, useUiStore } from 'ecto-core';

/**
 * Listens for deep links from the Electron main process (ecto:// protocol).
 * Currently handles invite links: ecto://invite/{code}
 *
 * Only active in Electron — no-ops in browser builds.
 */
export function useDeepLink() {
  useEffect(() => {
    if (!window.electronAPI?.onDeepLink) return;

    const unsubscribe = window.electronAPI.onDeepLink(async (data) => {
      if (data.type === 'invite' && data.code) {
        try {
          const { server_address } = await connectionManager.resolveInvite(data.code);
          useUiStore.getState().openModal('server-join', {
            address: server_address,
            invite: data.code,
          });
        } catch {
          // Resolution failed — still open the modal so user sees an error
          useUiStore.getState().openModal('server-join', {
            address: '',
            invite: data.code,
          });
        }
      }
    });

    return unsubscribe;
  }, []);
}
