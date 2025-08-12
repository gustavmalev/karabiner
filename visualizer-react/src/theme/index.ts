import { HeroUIProvider } from '@heroui/react';
import React, { type PropsWithChildren } from 'react';

// Design tokens (CSS variables) consumed by Tailwind and components
export const tokens = {
  colors: {
    primary: 'rgb(34 197 94)', // green-500
    primaryForeground: 'rgb(255 255 255)',
    secondary: 'rgb(59 130 246)', // blue-500
    danger: 'rgb(244 63 94)', // rose-500
    muted: 'rgb(107 114 128)', // gray-500
    background: 'rgb(250 250 250)',
    foreground: 'rgb(23 23 23)',
  },
  radius: {
    sm: '6px',
    md: '10px',
    lg: '14px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
  },
} as const;

export function injectCSSVariables() {
  const root = document.documentElement;
  root.style.setProperty('--color-primary', tokens.colors.primary);
  root.style.setProperty('--color-primary-foreground', tokens.colors.primaryForeground);
  root.style.setProperty('--color-secondary', tokens.colors.secondary);
  root.style.setProperty('--color-danger', tokens.colors.danger);
  root.style.setProperty('--color-muted', tokens.colors.muted);
  root.style.setProperty('--color-background', tokens.colors.background);
  root.style.setProperty('--color-foreground', tokens.colors.foreground);
  root.style.setProperty('--radius-sm', tokens.radius.sm);
  root.style.setProperty('--radius-md', tokens.radius.md);
  root.style.setProperty('--radius-lg', tokens.radius.lg);
}

export function ThemeProvider({ children }: PropsWithChildren) {
  // Centralize HeroUI provider settings here (no JSX to keep this file as .ts)
  return React.createElement(
    HeroUIProvider as unknown as React.ComponentType<any>,
    { disableAnimation: true, skipFramerMotionAnimations: true, reducedMotion: 'user' },
    children,
  );
}
