# Visualizer Design System

This document standardizes our UI using HeroUI and Tailwind, aiming to reduce custom CSS and ensure consistency.

## Foundations

- **Provider**: Use `ThemeProvider` from `src/theme/` in `src/main.tsx`.
- **Tokens**: CSS variables injected by `injectCSSVariables()` and exposed in Tailwind as `colors`, `borderRadius`, and `spacing`.
- **Motion**: Animations are globally disabled to improve bundle size and performance. Do not re-enable per-component.

## Components

- **Import surface**: Always import UI from `src/components/ui/`.
- **Buttons**: `variant="solid|flat|bordered"`, `color="primary|secondary|danger|default"`.
- **Inputs**: Use `Input`, `Select`, `Autocomplete` with external labels and standardized sizes (`size="sm|md|lg"`).
- **Tooltips**: Use `Tooltip` with `motionProps={overlayMotion}` only via existing helper.
- **Modals**: Use `Modal` wrapper from `src/components/Modals/Modal.tsx`.
- **Navigation**: Use `Navbar`, `Tabs`, `Dropdown` from the UI index.

## Patterns

- **Form fields**: Prefer label placement `outside`. Avoid custom classNames unless necessary.
- **Spacing**: Prefer Tailwind spacing tokens (xs, sm, md, lg, xl) or component props.
- **Color**: Use Tailwind classes mapped to CSS variables (e.g., `text-primary`, `bg-background`).
- **Radius**: Use `rounded-*` matching Tailwind tokens tied to CSS variables.

## Accessibility

- Ensure keyboard navigation works for all interactive components.
- Provide labels for inputs and aria attributes where applicable.

## Migration Rules

- Replace direct `@heroui/react` imports with `src/components/ui` imports.
- Replace custom CSS where feasible with Tailwind classes or HeroUI props.

## Coverage

- Standardization applied to menus, modals, forms, notifications, layout, and grid components.

## Verification

- Build passes with strict TypeScript.
- Visual inspection across primary pages.
- CSS reduction via reuse of HeroUI and Tailwind tokens.
