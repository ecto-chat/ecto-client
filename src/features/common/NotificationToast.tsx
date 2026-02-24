import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useToastStore, type Toast } from '@/stores/toast';
import { useUiStore } from '@/stores/ui';
import { connectionManager } from '@/services/connection-manager';
import { Avatar } from '@/ui/Avatar';

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
    if (toast.peerId) {
      navigate(`/dms/${toast.peerId}`);
    } else {
      useUiStore.getState().setActiveServer(toast.serverId);
      useUiStore.getState().setActiveChannel(toast.channelId);
      connectionManager.switchServer(toast.serverId).catch(() => {});
      navigate(`/servers/${toast.serverId}/channels/${toast.channelId}`);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      onClick={handleClick}
      className="pointer-events-auto relative flex items-center gap-3 overflow-hidden rounded-lg border-2 border-primary border-l-[3px] border-l-accent backdrop-blur-xl bg-secondary/95 shadow-[0_8px_32px_rgba(0,0,0,0.4)] px-4 py-3 max-w-sm cursor-pointer hover:bg-tertiary/95 transition-colors"
    >
      <Avatar src={toast.avatarUrl} username={toast.authorName} size={32} />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-semibold text-primary truncate">{toast.authorName}</span>
        <span className="text-xs text-secondary truncate">{toast.content}</span>
      </div>

      <motion.div
        className="absolute bottom-0 left-0 h-[2px] text-accent"
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: AUTO_DISMISS_MS / 1000, ease: 'linear' }}
        style={{ backgroundColor: 'currentColor', opacity: 0.4 }}
      />
    </motion.div>
  );
}

export function NotificationToast() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="fixed bottom-6 right-6 z-[250] flex flex-col-reverse gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
