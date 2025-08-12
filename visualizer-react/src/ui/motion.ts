// Centralized motion settings for consistent animations across overlays/components
// These variants are compatible with HeroUI components that accept `motionProps` (e.g., Tooltip, Popover, Modal, Drawer, Accordion)
// Easing approximates standard UI curves
export const overlayMotion = {
  variants: {
    enter: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.16,
        ease: [0.2, 0.8, 0.2, 1],
      },
    },
    exit: {
      opacity: 0,
      y: 6,
      scale: 0.98,
      transition: {
        duration: 0.12,
        ease: [0.4, 0.0, 1, 1],
      },
    },
  },
} as const;
