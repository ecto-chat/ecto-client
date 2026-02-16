import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToastStore, type Toast } from '../../stores/toast.js';
import { Avatar } from './Avatar.js';

const AUTO_DISMISS_MS = 5000;

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, removeToast]);

  const handleClick = () => {
    removeToast(toast.id);
    navigate(`/servers/${toast.serverId}/channels/${toast.channelId}`);
  };

  return (
    <div className="notification-toast" onClick={handleClick}>
      <Avatar src={toast.avatarUrl} username={toast.authorName} size={32} />
      <div className="notification-toast-body">
        <span className="notification-toast-author">{toast.authorName}</span>
        <span className="notification-toast-content">{toast.content}</span>
      </div>
    </div>
  );
}

export function NotificationToast() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div className="notification-toast-container">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
