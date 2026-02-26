import type { Transition, Variants } from 'motion/react';

// ── Transitions ──
export const springSnappy: Transition = { type: 'spring', stiffness: 400, damping: 30 };
export const springGentle: Transition = { type: 'spring', stiffness: 200, damping: 25 };
export const easePage: Transition = { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] };
export const easeContent: Transition = { duration: 0.2, ease: [0.4, 0, 0.2, 1] };

// ── Blur-to-clear (page transitions per design guidelines) ──
export const blurToClear: Variants = {
  hidden: { opacity: 0, filter: 'blur(4px)' },
  visible: { opacity: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, filter: 'blur(4px)' },
};

// ── Float in (for PiP media window) ──
export const floatIn: Variants = {
  hidden: { opacity: 0, scale: 0.8, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.8, y: 20 },
};

// ── Snap indicator (edge highlight) ──
export const snapIndicator: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// ── Spring dock (snap to edge) ──
export const springDock: Transition = { type: 'spring', stiffness: 500, damping: 35 };
