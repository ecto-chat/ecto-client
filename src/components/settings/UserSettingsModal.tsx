import { useState, useEffect, useMemo } from 'react';
import { useUiStore } from '../../stores/ui.js';
import { useAuthStore } from '../../stores/auth.js';
import { Modal } from '../common/Modal.js';
import { ProfileEditor } from './ProfileEditor.js';
import { PresencePicker } from './PresencePicker.js';
import { PasswordChange } from './PasswordChange.js';
import { AppearanceSettings } from './AppearanceSettings.js';
import { NotificationSettings } from './NotificationSettings.js';
import { AudioVideoSettings } from './AudioVideoSettings.js';
import { PrivacySettings } from './PrivacySettings.js';
import { AccountDeletion } from './AccountDeletion.js';

type Tab = 'account' | 'password' | 'appearance' | 'notifications' | 'audio-video' | 'privacy' | 'delete-account';

interface TabDef {
  key: Tab;
  label: string;
  danger?: boolean;
  requiresCentral?: boolean;
}

const ALL_TABS: TabDef[] = [
  { key: 'account', label: 'My Account' },
  { key: 'password', label: 'Password', requiresCentral: true },
  { key: 'appearance', label: 'Appearance' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'audio-video', label: 'Voice & Video' },
  { key: 'privacy', label: 'Privacy', requiresCentral: true },
  { key: 'delete-account', label: 'Delete Account', danger: true, requiresCentral: true },
];

export function UserSettingsModal() {
  const open = useUiStore((s) => s.activeModal === 'user-settings');
  const close = () => useUiStore.getState().closeModal();
  const centralAuthState = useAuthStore((s) => s.centralAuthState);
  const isCentral = centralAuthState === 'authenticated';

  const visibleTabs = useMemo(
    () => ALL_TABS.filter((tab) => !tab.requiresCentral || isCentral),
    [isCentral],
  );

  const [activeTab, setActiveTab] = useState<Tab>('account');

  useEffect(() => {
    if (open) setActiveTab('account');
  }, [open]);

  if (!open) return null;

  return (
    <Modal open={open} onClose={close} title="User Settings" width={800}>
      <div className="settings-page" style={{ minHeight: 480 }}>
        <nav className="settings-tabs">
          {visibleTabs.map((tab) => (
            <div key={tab.key}>
              {tab.key === 'delete-account' && <div className="settings-tab-separator" />}
              <button
                className={`settings-tab ${activeTab === tab.key ? 'active' : ''} ${tab.danger ? 'danger' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            </div>
          ))}
        </nav>

        <div className="settings-content">
          {activeTab === 'account' && (
            <>
              <ProfileEditor />
              {isCentral && <PresencePicker />}
            </>
          )}
          {activeTab === 'password' && <PasswordChange />}
          {activeTab === 'appearance' && <AppearanceSettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'audio-video' && <AudioVideoSettings />}
          {activeTab === 'privacy' && <PrivacySettings />}
          {activeTab === 'delete-account' && <AccountDeletion />}
        </div>
      </div>
    </Modal>
  );
}
