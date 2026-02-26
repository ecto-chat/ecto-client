import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Check, LogOut, Plus } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { useNotifyStore } from '@/stores/notify';
import { useVoiceStore } from '@/stores/voice';
import { useCallStore } from '@/stores/call';
import { connectionManager } from '@/services/connection-manager';
import { resetAllStores, fullLogout } from '@/stores/reset';
import { preferenceManager } from '@/services/preference-manager';
import { getAccounts, getActiveUserId, getAccountCount } from '@/services/account-registry';
import {
  Avatar,
  IconButton,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  ConfirmDialog,
} from '@/ui';

export function UserBar() {
  const user = useAuthStore((s) => s.user);
  const isCentralAuth = useAuthStore((s) => s.isCentralAuth());
  const navigate = useNavigate();
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);

  const accounts = isCentralAuth ? getAccounts() : [];
  const activeUserId = getActiveUserId();
  const accountCount = getAccountCount();
  const showAccountSwitcher = isCentralAuth && accountCount >= 1;

  const handleSwitchAccount = useCallback(async (targetUserId: string) => {
    if (targetUserId === activeUserId) return;

    const currentActiveServer = useUiStore.getState().activeServerId;
    if (currentActiveServer) {
      preferenceManager.setUser('last-active-server', currentActiveServer);
    }

    useVoiceStore.getState().cleanup();
    useCallStore.getState().cleanup();
    connectionManager.disconnectAll();
    resetAllStores();

    await useAuthStore.getState().switchAccount(targetUserId);
    useNotifyStore.getState().hydrateFromPreferences();
    useUiStore.getState().hydrateFromPreferences();

    const lastServer = preferenceManager.getUser<string | null>('last-active-server', null);
    if (lastServer) {
      navigate(`/servers/${lastServer}/channels`);
    } else {
      navigate('/');
    }
  }, [activeUserId, navigate]);

  const handleSignOut = useCallback(async () => {
    if (showAccountSwitcher) {
      useVoiceStore.getState().cleanup();
      useCallStore.getState().cleanup();
      connectionManager.disconnectAll();
      await useAuthStore.getState().logout();
      resetAllStores();

      const remaining = getAccounts();
      if (remaining.length > 0) {
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
    } else {
      fullLogout().then(() => navigate('/landing'));
    }
  }, [showAccountSwitcher, navigate]);

  const handleSignOutAll = useCallback(async () => {
    setConfirmLogoutAll(false);
    useVoiceStore.getState().cleanup();
    useCallStore.getState().cleanup();
    connectionManager.disconnectAll();
    await useAuthStore.getState().logoutAll();
    resetAllStores();
    navigate('/landing');
  }, [navigate]);

  const handleAddAccount = useCallback(() => {
    useUiStore.getState().openModal('add-account');
  }, []);

  return (
    <>
      <div className="flex h-[60px] shrink-0 items-center gap-2 border-t-3 border-primary bg-[rgba(18,18,30,0.8)] px-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer rounded p-1 -m-1 transition-colors hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <Avatar
                src={user?.avatar_url ?? undefined}
                username={user?.username ?? '?'}
                size={32}
              />
              <div className="flex flex-col min-w-0 flex-1">
                <div className="text-sm font-medium text-primary truncate text-left">
                  {user?.display_name ?? user?.username ?? 'User'}
                </div>
                <div className="text-2xs text-muted text-left">
                  #{user?.discriminator ?? '0000'}
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-64">
            {showAccountSwitcher && (
              <>
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
                      <span className="text-xs text-muted truncate">{account.displayName}#{account.discriminator}</span>
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
              </>
            )}
            <DropdownMenuItem onSelect={handleSignOut}>
              <LogOut className="size-4 text-muted" />
              <span>Sign Out</span>
            </DropdownMenuItem>
            {showAccountSwitcher && accountCount > 1 && (
              <DropdownMenuItem onSelect={() => setConfirmLogoutAll(true)}>
                <LogOut className="size-4 text-danger" />
                <span className="text-danger">Sign Out All</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <IconButton
          variant="ghost"
          size="sm"
          tooltip="User Settings"
          onClick={() => useUiStore.getState().openModal('user-settings')}
        >
          <Settings size={16} />
        </IconButton>
      </div>

      {showAccountSwitcher && accountCount > 1 && (
        <ConfirmDialog
          open={confirmLogoutAll}
          onOpenChange={setConfirmLogoutAll}
          title="Sign Out All Accounts"
          description={`Sign out of all ${accountCount} accounts on this device?`}
          confirmLabel="Sign Out All"
          variant="danger"
          onConfirm={handleSignOutAll}
        />
      )}
    </>
  );
}
