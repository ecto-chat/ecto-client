import { useEffect, useMemo } from 'react';

import { User, Lock, Palette, Bell, Mic, Shield, AlertTriangle } from 'lucide-react';

import { Modal, Tabs, TabsList, TabsTrigger, TabsContent, Separator } from '@/ui';

import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';

import { ProfileEditor } from './ProfileEditor';
import { PresencePicker } from './PresencePicker';
import { PasswordChange } from './PasswordChange';
import { AppearanceSettings } from './AppearanceSettings';
import { NotificationSettings } from './NotificationSettings';
import { AudioVideoSettings } from './AudioVideoSettings';
import { PrivacySettings } from './PrivacySettings';
import { AccountDeletion } from './AccountDeletion';

type Tab = 'account' | 'password' | 'appearance' | 'notifications' | 'audio-video' | 'privacy' | 'delete-account';

type TabDef = {
  key: Tab;
  label: string;
  icon: typeof User;
  danger?: boolean;
  requiresCentral?: boolean;
};

const ALL_TABS: TabDef[] = [
  { key: 'account', label: 'My Account', icon: User },
  { key: 'password', label: 'Password', icon: Lock, requiresCentral: true },
  { key: 'appearance', label: 'Appearance', icon: Palette },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'audio-video', label: 'Voice & Video', icon: Mic },
  { key: 'privacy', label: 'Privacy', icon: Shield, requiresCentral: true },
  { key: 'delete-account', label: 'Delete Account', icon: AlertTriangle, danger: true, requiresCentral: true },
];

export function UserSettingsModal() {
  const open = useUiStore((s) => s.activeModal === 'user-settings');
  const centralAuthState = useAuthStore((s) => s.centralAuthState);
  const isCentral = centralAuthState === 'authenticated';

  const visibleTabs = useMemo(
    () => ALL_TABS.filter((tab) => !tab.requiresCentral || isCentral),
    [isCentral],
  );

  const handleOpenChange = (value: boolean) => {
    if (!value) useUiStore.getState().closeModal();
  };

  useEffect(() => {
    // Reset handled by Tabs defaultValue
  }, [open]);

  if (!open) return null;

  return (
    <Modal open={open} onOpenChange={handleOpenChange} title="User Settings" width="full">
      <Tabs defaultValue="account" className="flex gap-6 min-h-0">
        <TabsList className="flex-col w-48 shrink-0 bg-transparent p-0 gap-0.5">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <div key={tab.key}>
                {tab.key === 'delete-account' && <Separator className="my-2" />}
                <TabsTrigger
                  value={tab.key}
                  className={`w-full justify-start gap-2 px-3 py-2 text-sm ${tab.danger ? 'data-[state=active]:text-danger text-danger/70' : ''}`}
                >
                  <Icon size={16} />
                  {tab.label}
                </TabsTrigger>
              </div>
            );
          })}
        </TabsList>

        <div className="flex-1 min-w-0">
          <TabsContent value="account">
            <ProfileEditor />
            {isCentral && <PresencePicker />}
          </TabsContent>
          <TabsContent value="password"><PasswordChange /></TabsContent>
          <TabsContent value="appearance"><AppearanceSettings /></TabsContent>
          <TabsContent value="notifications"><NotificationSettings /></TabsContent>
          <TabsContent value="audio-video"><AudioVideoSettings /></TabsContent>
          <TabsContent value="privacy"><PrivacySettings /></TabsContent>
          <TabsContent value="delete-account"><AccountDeletion /></TabsContent>
        </div>
      </Tabs>
    </Modal>
  );
}
