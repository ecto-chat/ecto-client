# <img src="ecto.png" alt="ecto" height="32"> ecto-client

The desktop and web client for [Ecto](https://ecto.chat) - a federated chat platform where users own their servers and traverse freely between communities through a unified client.

<details>
<summary><img src="https://img.shields.io/badge/AI--Assisted_Development_Disclosure-Claude_(Anthropic)-8A2BE2?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJ3aGl0ZSI+PHBhdGggZD0iTTEyIDJhMTAgMTAgMCAxIDAgMCAyMCAxMCAxMCAwIDAgMCAwLTIwem0wIDE4YTggOCAwIDEgMSAwLTE2IDggOCAwIDAgMSAwIDE2eiIvPjwvc3ZnPg==" alt="AI-Assisted Development" /></summary>

<br>

> [!NOTE]
> This project uses **Claude** (Anthropic) as a development tool. Responsible AI-assisted development means every generated contribution is reviewed, tested, and validated by the project team before merging. AI accelerates development, it does not replace engineering judgment, code review, or security auditing.
>
> **Security & privacy measures protecting end users:**
>
> - **HTML/XSS Sanitization** - All user-generated content is sanitized via DOMPurify with strict tag, attribute, and CSS property allowlists; blocks `javascript:`, `expression()`, and `url()` injection vectors
> - **Secure Credential Storage** - Tokens are encrypted at rest using the OS keychain (Electron `safeStorage` API); web builds use `localStorage` behind HTTPS
> - **Token Lifecycle Management** - Automatic token refresh with rotation, Web Locks API to prevent race conditions, cross-tab coordination via BroadcastChannel, and forced re-auth on token reuse detection
> - **Server Address Validation** - Public servers enforce HTTPS; LAN addresses are detected automatically and allowed over HTTP for self-hosted setups
> - **Markdown Rendering Pipeline** - User content rendered through `marked` + DOMPurify; iframe embeds restricted to YouTube and Vimeo; images restricted to HTTPS sources
> - **CSS Injection Prevention** - Custom theming uses CSS property allowlisting to prevent script injection via style attributes

</details>

---

## Features

### Chat & Messaging
- Rich text composition with markdown toolbar, mentions (`@user`, `#channel`, `@role`), and emoji/GIF picker
- Message editing, deletion, pinning, reactions, and reply threading
- File attachments with drag-and-drop upload
- Link previews, YouTube/Vimeo embeds, and image galleries with lightbox
- Spoiler tags, code blocks, and inline formatting
- Channel-scoped message search

### Voice & Video
- Voice channels with up to 25 participants via mediasoup SFU
- 1:1 friend-to-friend calls (audio + video)
- Screen sharing in voice channels and 1:1 calls
- Device selection (mic, camera, speaker) with quality presets
- Real-time speaking detection and audio level visualization
- Connection quality stats overlay (bitrate, packet loss)

### Servers & Federation
- Connect to any Ecto server (self-hosted or official) from one client
- Multi-server sidebar with simultaneous connections
- Server discovery and invite code joining
- Offline server detection with automatic reconnection
- Server admin panel: roles, permissions, channels, categories, invites, audit log, webhooks

### Friends & Direct Messages
- Cross-server friends list via ecto-central
- Direct messages routed through central service
- Within-server DMs for local-only communities
- Online/idle/offline presence with custom status text
- Typing indicators

### Desktop Experience
- Electron app with native notifications
- Encrypted credential storage via OS keychain
- Push-to-talk hotkey support
- Custom CSS theming and dark/light mode

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    React 19 + Router 7               │
│   ┌───────────┐  ┌──────────┐  ┌───────────────────┐ │
│   │ Features  │  │  Hooks   │  │   UI Components   │ │
│   │ (18 dirs) │  │ (16)     │  │   (Radix-based)   │ │
│   └─────┬─────┘  └────┬─────┘  └────────┬──────────┘ │
│         └─────────────┼─────────────────┘            │
│                       ▼                              │
│              Zustand Stores (20)                     │
│                       ▼                              │
│              Core Services (17)                      │
│  ┌────────────┬───────────────┬──────────────────┐   │
│  │ Connection │   Main WS     │   Central WS     │   │
│  │  Manager   │  (per server) │  (friends/DMs)   │   │
│  └────────────┴───────────────┴──────────────────┘   │
│  ┌────────────┬───────────────┬──────────────────┐   │
│  │  tRPC      │  Voice Media  │  Call Media      │   │
│  │  Client    │  (mediasoup)  │  (mediasoup)     │   │
│  └────────────┴───────────────┴──────────────────┘   │
└──────────────────────────────────────────────────────┘
```

**State Management** - Zustand stores with normalized data (messages, members, servers keyed by ID). Selectors prevent unnecessary re-renders.

**Connection Model** - Each server gets its own WebSocket + tRPC client. Only the active server's MainWS is fully hydrated; background servers use lightweight NotifyWS. A separate CentralWS handles friends, DMs, calls, and presence.

**Two-Track Boot** - Central auth mode fetches the server list then connects in priority order. Local-only mode loads stored sessions and connects all servers in parallel.

**Lazy Loading** - Heavy modals (settings, profiles, call overlay, lightbox) are code-split to reduce initial bundle by ~92KB.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 19, React Router 7, Tailwind CSS 4, Radix UI |
| State | Zustand 5 |
| API | tRPC 11 (HTTP), raw `ws` (WebSocket) |
| Media | mediasoup-client 3 (WebRTC SFU) |
| Desktop | Electron 40 |
| Build | Vite 7, electron-vite 5 |
| Language | TypeScript 5.9 (strict) |
| Sanitization | DOMPurify 3, marked 17 |
| Animation | Motion 12 |
| Package Manager | pnpm |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_CENTRAL_URL` | `https://api.ecto.chat` | ecto-central API base URL |
| `VITE_KLIPY_APP_KEY` | - | API key for GIF picker (Klipy) |
| `VITE_DEV_SERVER_URL` | - | Vite dev server URL (Electron dev mode) |

---

## Setup

```bash
pnpm install
pnpm dev            # Vite dev server on :5173
pnpm electron:dev   # Electron dev mode
pnpm build          # Production build
```

Requires **Node.js 22+**. For full functionality (friends, cross-server DMs, global accounts), set `VITE_CENTRAL_URL` to a running ecto-central instance. Without it, the client operates in **local-only mode** — connect directly to any self-hosted server using local username/password authentication.

---

## Project Structure

```
src/
├── features/        # Feature modules (auth, chat, voice, call, friends, admin, ...)
├── stores/          # Zustand stores (auth, message, voice, call, server, ...)
├── services/        # Core services (connection-manager, WS clients, tRPC, media)
├── hooks/           # React hooks (useInitialize, useMessages, useVoice, ...)
├── lib/             # Utilities (markdown, jwt, animations, media-presets)
├── ui/              # Radix-based UI primitives (Button, Modal, Select, ...)
├── layout/          # App layout (sidebar, header)
├── electron/        # Electron main process, preload, IPC handlers
└── assets/          # Static images
```
