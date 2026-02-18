# ecto-client

## Project Overview

Ecto client — React + Electron + TypeScript desktop/web app for a federated chat platform. Users connect to multiple self-hosted and official servers through a unified interface. The client is the product; monetization is client-side.

This repo implements the frontend. All specs and architecture decisions live in `ecto-docs`. Reference those before implementing any feature.

## Specs

- Architecture: `ecto-docs/docs/architecture.md`
- Client architecture: `ecto-docs/docs/technical/client-architecture/`
- State management: `ecto-docs/docs/technical/client-architecture/state-management.md`
- Connection management: `ecto-docs/docs/technical/client-architecture/connection-management.md`
- API reference: `ecto-docs/docs/technical/api-reference/`
- Feature specs: `ecto-docs/docs/features/`

## Design System

**Canonical spec**: `ecto-docs/docs/technical/DESIGN-GUIDELINES.md`

Dark-only. Memoria-inspired. Calm, premium aesthetic. Hierarchy through size and opacity, never through color or weight. Sequential revelation animations. Generous whitespace. No light mode. No theme switching. No `data-theme` attributes. If you find light mode code, remove it.

## Tech Stack

| Component | Version |
|---|---|
| React | 19 |
| TypeScript | 5.9 |
| Vite | 7 |
| Electron | 40 |
| Zustand | 5 |
| tRPC | 11 |
| React Router | 7 |
| Tailwind CSS | v4 |
| Radix UI | Primitives (Dialog, ContextMenu, Tooltip, ScrollArea, Tabs, Select, Switch, etc.) |
| motion/react | Animations (springs, layout, AnimatePresence) |
| Lucide React | Icons |
| ESLint | 9 (typescript-eslint 8 — do NOT use ESLint 10) |
| Vitest | 4 |

## Build Commands

```bash
pnpm dev           # Vite dev server on :5173
pnpm build         # tsc + vite build
pnpm typecheck     # tsc --noEmit
pnpm lint          # eslint src/
pnpm test          # vitest run
pnpm electron:dev  # Electron + Vite dev
pnpm electron:build # Electron production build
```

## Key Conventions

- **pnpm** with `onlyBuiltDependencies` in package.json.
- **`noUncheckedIndexedAccess: true`** — all indexed access returns `T | undefined`. Handle it.
- **`cn()` utility** from `@/lib/cn` for merging Tailwind classes (clsx + tailwind-merge).
- **No light mode.** Remove any found.
- **No CSS files per component.** Tailwind utility classes only. One global CSS file for Tailwind + base reset.
- **No inline `style={}`** except for truly dynamic values (mouse position, computed widths).
- **No `transition: all`** in Tailwind classes. Explicitly name transitioned properties (`transition-colors`, `transition-opacity`, etc.).

---

## File Structure

```
src/
├── ui/                    # Design system primitives (leaf dependency)
├── features/              # Feature domains
│   ├── auth/
│   ├── chat/
│   ├── voice/
│   ├── call/
│   ├── friends/
│   ├── servers/
│   ├── admin/
│   ├── settings/
│   ├── user/
│   └── common/
├── layout/                # App shell
│   ├── AppLayout.tsx
│   ├── ServerSidebar/
│   ├── ChannelSidebar/
│   └── MemberList/
├── stores/                # Zustand stores
├── hooks/                 # Shared hooks
├── services/              # WebSocket, tRPC, connection management
├── lib/                   # Pure utilities (cn, markdown, etc.)
├── types/                 # TypeScript types and declarations
├── assets/                # Static assets
└── main.tsx               # Entry point
```

### Dependency Rules

These are strict. Violations break the architecture.

| Layer | Can import from | NEVER imports from |
|---|---|---|
| `src/ui/` | Only: React, third-party libs, `@/lib` | `features/`, `layout/`, `stores/`, `hooks/`, `services/` |
| `src/features/{domain}/` | `@/ui`, `@/stores`, `@/hooks`, `@/services`, `@/lib`, `@/types` | Other feature domains (`features/chat/` must not import from `features/voice/`) |
| `src/layout/` | `@/ui`, `@/features`, `@/stores`, `@/hooks`, `@/services`, `@/lib` | — |
| `src/stores/` | `@/lib`, `@/types`, `@/services` | `@/ui`, `@/features`, `@/layout` |
| `src/hooks/` | `@/stores`, `@/services`, `@/lib`, `@/types` | `@/ui`, `@/features`, `@/layout` |
| `src/services/` | `@/stores`, `@/lib`, `@/types` | `@/ui`, `@/features`, `@/layout`, `@/hooks` |
| `src/lib/` | Only: third-party libs, `@/types` | Everything else |

**`src/ui/` is a leaf dependency.** It knows nothing about the application. It is pure design system.

**Feature domains are isolated.** If `chat/` and `voice/` need to share behavior, it goes in a shared hook (`@/hooks`) or store (`@/stores`), not through cross-domain imports.

### Path Aliases

| Alias | Target |
|---|---|
| `@/ui` | `src/ui` |
| `@/features` | `src/features` |
| `@/layout` | `src/layout` |
| `@/stores` | `src/stores` |
| `@/hooks` | `src/hooks` |
| `@/services` | `src/services` |
| `@/lib` | `src/lib` |
| `@/types` | `src/types` |

### File Organization

- **Every directory has an `index.ts` barrel export.** External consumers import from the barrel, never from internal files.
- **Complex components get a folder**: `ComponentName/ComponentName.tsx` + sub-components + `index.ts` barrel.
- **Simple components are single files**: `ComponentName.tsx` in their domain directory.

---

## Import Order

Maintain this order in every file, with blank lines between groups:

```tsx
// 1. React
import { useState, useCallback } from 'react';

// 2. Third-party libraries (radix, motion, lucide, etc.)
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Settings } from 'lucide-react';

// 3. UI primitives
import { Button, Modal, Input } from '@/ui';

// 4. Features
import { ChannelView } from '@/features/chat';

// 5. Layout
import { AppLayout } from '@/layout';

// 6. Stores
import { useAuthStore } from '@/stores/auth';

// 7. Hooks
import { useChannels } from '@/hooks/useChannels';

// 8. Services
import { connectionManager } from '@/services/connection-manager';

// 9. Lib utilities
import { cn } from '@/lib/cn';

// 10. Types
import type { Server } from '@/types';

// 11. Relative imports (sub-components, local types)
import { MessageBubble } from './MessageBubble';
```

---

## Component Rules

### General

- **One component per file.** Max ~150 lines. If longer, decompose into sub-components.
- **Named exports only.** No default exports.
- **Props type defined inline or as `type ComponentNameProps`** — not `interface`, not exported separately unless shared.
- **No `React.FC`.** Use plain function declarations: `export function Button({ ... }: ButtonProps) { ... }`.

### Use UI Primitives

Never write raw HTML for interactive elements. Always use the design system:

| Instead of... | Use... |
|---|---|
| `<button>` | `<Button>` or `<IconButton>` from `@/ui` |
| `<input>` | `<Input>` from `@/ui` |
| `<textarea>` | `<TextArea>` from `@/ui` |
| `<select>` | `<Select>` from `@/ui` |
| `<dialog>` or hand-rolled modal | `<Modal>` from `@/ui` |
| `title="..."` attribute | `<Tooltip>` from `@/ui` |
| Hand-rolled dropdown with portals | `<DropdownMenu>` from `@/ui` |
| Hand-rolled context menu | `<ContextMenu>` from `@/ui` |
| Overflow scrolling div | `<ScrollArea>` from `@/ui` with ProgressiveBlur |
| Toggle checkbox | `<Switch>` from `@/ui` |
| Loading spinner | `<Spinner>` from `@/ui` |
| Empty list placeholder | `<EmptyState>` from `@/ui` |

### Icons

- **Always `lucide-react`.** No inline SVGs. No emoji characters as icons.
- Standard sizes: 14px (inline), 16px (buttons/list items), 18px (standard), 20px (prominent), 24px (large).
- Color inherits from `currentColor` — control via Tailwind text color classes.

### Styling

- **Tailwind utility classes only.** No CSS files. No `styled-components`. No CSS modules.
- Use `cn()` from `@/lib/cn` for conditional class merging.
- No hardcoded hex values. Use Tailwind theme tokens: `bg-primary`, `text-secondary`, `border-border`, etc.
- No `style={}` except for truly dynamic values (mouse position, drag offsets, computed dimensions).
- No `transition-all`. Name specific properties: `transition-colors`, `transition-opacity`, `transition-transform`.

### Animations

- Use `motion/react` for entrance/exit/layout animations.
- Standard spring configs (defined in design guidelines):
  - `spring-modal`: `{ type: 'spring', stiffness: 260, damping: 20 }`
  - `spring-bounce`: `{ type: 'spring', stiffness: 300, damping: 15 }`
  - `spring-smooth`: `{ type: 'spring', stiffness: 200, damping: 25 }`
- Standard easings: `ease-page`, `ease-content`, `ease-out-expo`.
- List items stagger at 0.03-0.05s intervals. Never exceed 0.5s total stagger.
- Respect `prefers-reduced-motion`.

### Context Menus and Modals

- **Context menus**: Always Radix ContextMenu via `<ContextMenu>` from `@/ui`. Never hand-roll with portals and click handlers.
- **Modals**: Always `<Modal>` from `@/ui` with spring entrance animation. Focus trapped. Escape closes.
- **Destructive actions**: Always require confirmation via `<ConfirmDialog>`.

### Scroll Containers

- Every list that could exceed its viewport MUST use `<ScrollArea>` from `@/ui` with ProgressiveBlur.
- Ask: "Would this list work with 50+ items?" If yes, use ScrollArea.

---

## UI Primitives Catalog

All imported from `@/ui`:

| Component | Variants / Props | Notes |
|---|---|---|
| `Button` | variants: `primary`, `secondary`, `danger`, `ghost`; sizes: `sm`, `md`, `lg` | Always use instead of `<button>` |
| `IconButton` | Same variants/sizes as Button | For icon-only buttons, wraps with Tooltip |
| `Input` | `label`, `error`, `placeholder` props | Never use `<input>` directly |
| `TextArea` | `label`, `error` props | Never use `<textarea>` directly |
| `Select` | Radix Select wrapper | Never use `<select>` directly |
| `Modal` | Radix Dialog wrapper, spring entrance | Focus trapped, Escape closes |
| `ConfirmDialog` | Extends Modal for destructive confirmations | Required for all destructive actions |
| `Tooltip` | Wraps Radix Tooltip | Use instead of `title=""` attribute |
| `DropdownMenu` | Radix DropdownMenu wrapper | For action menus |
| `ContextMenu` | Radix ContextMenu wrapper | For right-click menus |
| `ScrollArea` | With ProgressiveBlur fade edges | For all scrollable containers |
| `Avatar` | Status dot, hash-color fallback | For user/server avatars |
| `Badge` | variants: `default`, `secondary`, `danger`, `success` | For counts, labels |
| `Tabs` | Radix Tabs, animated indicator | For tabbed interfaces |
| `Switch` | Radix Switch | For boolean toggles |
| `Spinner` | Loading indicator | For async states |
| `Separator` | Radix Separator | For visual dividers |
| `EmptyState` | Icon, title, description, optional action | For empty lists/views |
| `Toast` | Animated notifications | Use via `useToast()` hook |

---

## Color Tokens (Tailwind)

Use these Tailwind classes. Never hardcode hex values.

### Backgrounds
`bg-primary` (app bg), `bg-secondary` (sidebars/cards), `bg-tertiary` (elevated), `bg-hover` (hover states), `bg-active` (selected), `bg-input` (inputs), `bg-surface` (floating)

### Text
`text-primary` (headings/content), `text-secondary` (descriptions), `text-muted` (hints/placeholders), `text-inverse` (on accent bg)

### Borders
`border-border` (default), `border-hover` (hover), `border-active` (focus)

### Semantic
`text-accent` / `bg-accent` (primary actions), `text-danger` / `bg-danger` (errors/destructive), `text-success` / `bg-success` (confirmations), `text-warning` / `bg-warning` (cautions)

### Status (presence only)
`bg-status-online`, `bg-status-idle`, `bg-status-dnd`, `bg-status-offline` — used ONLY for presence dots, call status, connection status.

---

## State Management

- **Zustand** with normalized stores. One store per domain (`auth.ts`, `message.ts`, `voice.ts`, etc.).
- Stores live in `src/stores/`. Hooks that compose multiple stores live in `src/hooks/`.
- Never put UI state (hover, focus, local form state) in Zustand. Use React state for ephemeral UI state.
- Use selectors to avoid unnecessary re-renders: `useAuthStore(s => s.user)`, not `useAuthStore()`.

## Services

- `connection-manager.ts` — manages per-server WebSocket connections and tRPC clients.
- `main-ws.ts` — server WebSocket (messages, channels, voice state).
- `central-ws.ts` — central WebSocket (friends, DMs, calls, notifications).
- `notify-ws.ts` — notification WebSocket.
- `trpc.ts` — tRPC client setup.

---

## Testing

- **Vitest** for unit and component tests.
- Test files live in `tests/` or colocated as `*.test.ts(x)`.
- Run with `pnpm test`.

---

## Prohibited

| Do not... | Reason |
|---|---|
| Use emoji as icons | Renders inconsistently. Use Lucide. |
| Use gradients | Violates monochromatic design. Exception: ProgressiveBlur (functional). |
| Use bold (700+) for emphasis | Size and opacity handle hierarchy. |
| Use skeleton loaders | Use fade-in. Skeletons add visual noise. |
| Use `React.FC` | Use plain function declarations. |
| Use default exports | Named exports only, for consistent imports. |
| Use CSS files / CSS modules | Tailwind only. |
| Use `styled-components` | Tailwind only. |
| Cross-import feature domains | `features/chat/` must never import from `features/voice/`. Use shared hooks/stores. |
| Import app code from `ui/` | `ui/` is a leaf. It knows nothing about the app. |
| Use `transition-all` | Name specific properties. |
| Hardcode hex color values | Use Tailwind theme tokens. |
| Add light mode / theme switching | Dark only. Forever. |
| Use `title=""` for tooltips | Use `<Tooltip>` component. |
| Write raw `<button>`, `<input>`, `<dialog>` | Use UI primitives from `@/ui`. |
| Use inline SVGs | Use Lucide React icons. |

---

## Quality Checklist

Before any component is considered complete:

- [ ] Uses UI primitives from `@/ui` (no raw HTML for interactive elements)
- [ ] All icons are Lucide — no emoji, no inline SVG
- [ ] Tailwind classes only — no CSS files, no hardcoded hex
- [ ] Component under ~150 lines
- [ ] Hover states on all interactive elements
- [ ] Destructive actions use `<ConfirmDialog>`
- [ ] Scrollable containers use `<ScrollArea>` with ProgressiveBlur
- [ ] Modals use spring entrance + focus trap
- [ ] Animations use standard easings/springs from design guidelines
- [ ] Empty states use `<EmptyState>` component
- [ ] No `transition-all` — specific properties only
- [ ] Text hierarchy via size and opacity, not color or weight
- [ ] Generous whitespace between sections
- [ ] Import order follows the convention
- [ ] No cross-domain feature imports
- [ ] Works with 50+ items if it is a list
- [ ] Overall feel: calm, premium, modern
