import { useState, useEffect } from 'react';
import { requestNotificationPermission } from '../../services/notification-service.js';

const DISMISSED_KEY = 'ecto-notification-prompt-dismissed';

export function NotificationPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show for web browsers, not Electron
    if (window.electronAPI) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  const handleAccept = async () => {
    await requestNotificationPermission();
    setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      zIndex: 9999,
    }}>
      <div style={{
        backgroundColor: 'var(--bg-primary, #36393f)',
        borderRadius: 8,
        padding: 24,
        maxWidth: 400,
        width: '90%',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}>
        <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary, #fff)', fontSize: 18 }}>
          Enable Desktop Notifications
        </h3>
        <p style={{ margin: '0 0 20px', color: 'var(--text-secondary, #b9bbbe)', fontSize: 14, lineHeight: 1.5 }}>
          Get notified about new messages, mentions, DMs, and incoming calls even when this tab is in the background.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={handleDismiss}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              border: 'none',
              borderRadius: 4,
              backgroundColor: 'var(--bg-tertiary, #202225)',
              color: 'var(--text-primary, #fff)',
              cursor: 'pointer',
            }}
          >
            Not Now
          </button>
          <button
            onClick={handleAccept}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              border: 'none',
              borderRadius: 4,
              backgroundColor: 'var(--accent, #5865f2)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Enable Notifications
          </button>
        </div>
      </div>
    </div>
  );
}
