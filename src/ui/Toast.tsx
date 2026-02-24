import { useCallback } from 'react';
import { create } from 'zustand';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ToastVariant = 'default' | 'success' | 'danger' | 'warning';

interface ToastEntry {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

/* ------------------------------------------------------------------ */
/*  Store                                                              */
/* ------------------------------------------------------------------ */

interface ToastStoreState {
  toasts: ToastEntry[];
  addToast: (message: string, variant?: ToastVariant, duration?: number) => void;
  removeToast: (id: string) => void;
}

let nextToastId = 0;

const useToastStore = create<ToastStoreState>()((set) => ({
  toasts: [],

  addToast: (message, variant = 'default', duration = 4000) => {
    const id = String(++nextToastId);

    set((state) => ({
      toasts: [...state.toasts, { id, message, variant, duration }],
    }));

    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, duration);
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

/* ------------------------------------------------------------------ */
/*  Variant config                                                     */
/* ------------------------------------------------------------------ */

const variantConfig: Record<ToastVariant, {
  icon: typeof Info;
  border: string;
  iconColor: string;
  bg: string;
}> = {
  default: {
    icon: Info,
    border: 'border-l-accent',
    iconColor: 'text-accent',
    bg: 'bg-accent-subtle',
  },
  success: {
    icon: CheckCircle,
    border: 'border-l-success',
    iconColor: 'text-success',
    bg: 'bg-success-subtle',
  },
  danger: {
    icon: XCircle,
    border: 'border-l-danger',
    iconColor: 'text-danger',
    bg: 'bg-danger-subtle',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-l-warning',
    iconColor: 'text-warning',
    bg: 'bg-warning-subtle',
  },
};

/* ------------------------------------------------------------------ */
/*  ToastCard                                                          */
/* ------------------------------------------------------------------ */

function ToastCard({ toast }: { toast: ToastEntry }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const config = variantConfig[toast.variant];
  const Icon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'relative overflow-hidden rounded-lg border-2 border-primary',
        'border-l-[3px]',
        config.border,
        'backdrop-blur-xl bg-secondary/95',
        'shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
        'min-w-[280px] max-w-sm',
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <Icon size={18} className={cn('shrink-0 mt-0.5', config.iconColor)} />
        <p className="text-sm text-primary flex-1 break-words leading-snug">{toast.message}</p>
        <button
          onClick={() => removeToast(toast.id)}
          className="shrink-0 rounded p-0.5 text-muted hover:text-primary transition-colors"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>

      {/* Progress bar */}
      <motion.div
        className={cn('absolute bottom-0 left-0 h-[2px]', config.iconColor)}
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: toast.duration / 1000, ease: 'linear' }}
        style={{ backgroundColor: 'currentColor', opacity: 0.4 }}
      />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  ToastContainer                                                     */
/* ------------------------------------------------------------------ */

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col-reverse gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastCard toast={t} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useToast() {
  const addToast = useToastStore((s) => s.addToast);

  const toast = useCallback(
    (message: string, variant?: ToastVariant, duration?: number) => {
      addToast(message, variant, duration);
    },
    [addToast],
  );

  return { toast };
}
