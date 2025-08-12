import React from 'react';
import type { PropsWithChildren, ReactNode } from 'react';

// No-op AnimatePresence that simply renders children
export const AnimatePresence: React.FC<PropsWithChildren<{ initial?: boolean; onExitComplete?: () => void }>> = ({ children }) => {
  return React.createElement(React.Fragment, null, children as ReactNode);
};

// Minimal no-op motion proxy: any motion.div/span/etc renders the underlying element
type MotionProps = { as?: React.ElementType; children?: ReactNode } & Record<string, unknown>;
export const motion: Record<string, React.FC<MotionProps>> = new Proxy({}, {
  get: () => (props: MotionProps) => {
    const { as: As = 'div', children, ...rest } = props || {};
    return React.createElement(As as React.ElementType, rest as Record<string, unknown>, children);
  },
});

// Alias 'm' commonly used by framer-motion
export const m = motion as typeof motion;

// Hooks/utilities returning safe defaults
export const useReducedMotion = () => true;
export const useAnimationControls = () => ({ start: async () => {} });
export const animate = () => ({ stop: () => {} });

// Minimal MotionConfig component and global config used by HeroUI
export const MotionConfig: React.FC<PropsWithChildren<{ reducedMotion?: 'never' | 'user' | 'always' }>> = ({ children }) => {
  return React.createElement(React.Fragment, null, children as ReactNode);
};
export const MotionGlobalConfig = {
  skipAnimations: true,
};

// Framer features API shims used by @heroui/framer-utils
export const LazyMotion: React.FC<PropsWithChildren<{ features?: unknown }>> = ({ children }) => {
  return React.createElement(React.Fragment, null, children as ReactNode);
};
export const domAnimation: Record<string, never> = {};
export const domMax: Record<string, never> = {};
export const useWillChange = () => undefined as undefined;
export const LayoutGroup: React.FC<PropsWithChildren<{ id?: string }>> = ({ children }) => {
  return React.createElement(React.Fragment, null, children as ReactNode);
};

// Types placeholders (optional consumers)
export type Variants = Record<string, unknown>;
export type Transition = Record<string, unknown>;
