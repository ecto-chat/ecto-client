import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, LogOut, Plus } from 'lucide-react';

import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { useNotifyStore } from '@/stores/notify';
import { connectionManager } from '@/services/connection-manager';
import { useVoiceStore } from '@/stores/voice';
import { useCallStore } from '@/stores/call';
import { resetAllStores } from '@/stores/reset';
import { preferenceManager } from '@/services/preference-manager';
import { getAccounts, getActiveUserId, getAccountCount } from '@/services/account-registry';

import {
  Avatar,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  Tooltip,
  ConfirmDialog,
} from '@/ui';

export function AccountSwitcher() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);

  const accounts = getAccounts();
  const activeUserId = getActiveUserId();
  const accountCount = getAccountCount();

  const handleSwitchAccount = useCallback(async (targetUserId: string) => {
    if (targetUserId === activeUserId) return;

    // Save current navigation state
    const currentActiveServer = useUiStore.getState().activeServerId;
    if (currentActiveServer) {
      preferenceManager.setUser('last-active-server', currentActiveServer);
    }

    // Suspend voice/call
    useVoiceStore.getState().cleanup();
    useCallStore.getState().cleanup();

    // Disconnect all
    connectionManager.disconnectAll();

    // Reset stores
    resetAllStores();

    // Hydrate user-tier preferences for new account
    await useAuthStore.getState().switchAccount(targetUserId);

    // Hydrate stores
    useNotifyStore.getState().hydrateFromPreferences();
    useUiStore.getState().hydrateFromPreferences();

    // Navigate to last active server or home
    const lastServer = preferenceManager.getUser<string | null>('last-active-server', null);
    if (lastServer) {
      navigate(`/servers/${lastServer}/channels`);
    } else {
      navigate('/');
    }
  }, [activeUserId, navigate]);

  const handleSignOut = useCallback(async () => {
    // Suspend voice/call
    useVoiceStore.getState().cleanup();
    useCallStore.getState().cleanup();

    // Disconnect all
    connectionManager.disconnectAll();

    // Full logout (clears tokens, user data, removes from registry)
    await useAuthStore.getState().logout();

    // Reset stores
    resetAllStores();

    // Check if there are remaining accounts
    const remaining = getAccounts();
    if (remaining.length > 0) {
      // Switch to the next account
      const nextAccount = remaining[0];
      if (nextAccount) {
        await useAuthStore.getState().switchAccount(nextAccount.userId);
      }
      useNotifyStore.getState().hydrateFromPreferences();
      useUiStore.getState().hydrateFromPreferences();
      navigate('/');
    } else {
      navigate('/landing');
    }
  }, [navigate]);

  const handleSignOutAll = useCallback(async () => {
    setConfirmLogoutAll(false);

    // Suspend voice/call
    useVoiceStore.getState().cleanup();
    useCallStore.getState().cleanup();

    // Disconnect all
    connectionManager.disconnectAll();

    // Logout all accounts
    await useAuthStore.getState().logoutAll();

    // Reset stores
    resetAllStores();

    navigate('/landing');
  }, [navigate]);

  const handleAddAccount = useCallback(() => {
    useUiStore.getState().openModal('add-account');
  }, []);

  return (
    <>
      <DropdownMenu>
        <Tooltip content={user?.display_name ?? user?.username ?? 'Account'} side="right">
          <DropdownMenuTrigger asChild>
            <button className="cursor-pointer rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <Avatar
                src={user?.avatar_url}
                username={user?.display_name ?? user?.username ?? '?'}
                size={40}
                status="online"
              />
            </button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-64">
          <DropdownMenuLabel>Accounts</DropdownMenuLabel>
          {accounts.map((account) => (
            <DropdownMenuItem
              key={account.userId}
              onSelect={() => handleSwitchAccount(account.userId)}
              className="gap-2"
            >
              <Avatar
                src={account.avatarUrl}
                username={account.displayName}
                size={28}
              />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium text-primary truncate">{account.displayName}</span>
                <span className="text-xs text-muted truncate">{account.username}#{account.discriminator}</span>
              </div>
              {account.userId === activeUserId && (
                <Check className="size-4 shrink-0 text-accent" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={handleAddAccount}
            disabled={accountCount >= 5}
          >
            <Plus className="size-4 text-muted" />
            <span>Add Account</span>
            {accountCount >= 5 && (
              <span className="ml-auto text-2xs text-muted">Max 5</span>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleSignOut}>
            <LogOut className="size-4 text-muted" />
            <span>Sign Out</span>
          </DropdownMenuItem>
          {accountCount > 1 && (
            <DropdownMenuItem onSelect={() => setConfirmLogoutAll(true)}>
              <LogOut className="size-4 text-danger" />
              <span className="text-danger">Sign Out All</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmLogoutAll}
        onOpenChange={setConfirmLogoutAll}
        title="Sign Out All Accounts"
        description={`Sign out of all ${accountCount} accounts on this device?`}
        confirmLabel="Sign Out All"
        variant="danger"
        onConfirm={handleSignOutAll}
      />
    </>
  );
}
