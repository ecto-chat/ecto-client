import { useState, useEffect } from 'react';

import { Bell } from 'lucide-react';

import { Button } from '@/ui';

import { requestNotificationPermission } from '@/services/notification-service';
import { preferenceManager } from '@/services/preference-manager';

export function NotificationPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.electronAPI) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    if (preferenceManager.getDevice('notification-prompt-dismissed', null) !== null) return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  const handleAccept = async () => {
    await requestNotificationPermission();
    setVisible(false);
  };

  const handleDismiss = () => {
    preferenceManager.setDevice('notification-prompt-dismissed', '1');
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[90%] max-w-[400px] rounded-lg bg-secondary p-6 shadow-lg">
        <div className="mb-3 flex items-center gap-2 text-primary">
          <Bell className="size-5 text-muted" />
          <h3 className="text-lg">Enable Desktop Notifications</h3>
        </div>

        <p className="mb-5 text-sm leading-relaxed text-secondary">
          Get notified about new messages, mentions, DMs, and incoming calls
          even when this tab is in the background.
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={handleDismiss}>
            Not Now
          </Button>
          <Button variant="primary" onClick={handleAccept}>
            Enable Notifications
          </Button>
        </div>
      </div>
    </div>
  );
}
