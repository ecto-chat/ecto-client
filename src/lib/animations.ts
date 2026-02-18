import type { Transition, Variants } from 'motion/react';

// ── Transitions ──
export const springModal: Transition = { type: 'spring', stiffness: 260, damping: 20 };
export const springSnappy: Transition = { type: 'spring', stiffness: 400, damping: 30 };
export const springGentle: Transition = { type: 'spring', stiffness: 200, damping: 25 };
export const easePage: Transition = { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] };
export const easeContent: Transition = { duration: 0.2, ease: [0.4, 0, 0.2, 1] };

// ── Fade ──
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// ── Slide up + fade (for page transitions) ──
export const slideUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

// ── Blur-to-clear (page transitions per design guidelines) ──
export const blurToClear: Variants = {
  hidden: { opacity: 0, filter: 'blur(4px)' },
  visible: { opacity: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, filter: 'blur(4px)' },
};

// ── Scale + fade (for modals, dropdowns) ──
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.97 },
};

// ── Slide from right (for sidebars, panels) ──
export const slideRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

// ── Slide from left ──
export const slideLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

// ── Stagger container (for lists) ──
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.02 },
  },
};

// ── Stagger item (children of stagger container) ──
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};
