# ecto-client

React + Electron desktop/web client for the Ecto federated chat platform.

## Specs
All implementations follow specs in `ecto-docs`:
- Client architecture: `ecto-docs/docs/technical/client-architecture/`
- State management: `ecto-docs/docs/technical/client-architecture/state-management.md`
- Connection management: `ecto-docs/docs/technical/client-architecture/connection-management.md`
- Features: `ecto-docs/docs/features/`

## Architecture
- React 19 + TypeScript
- Zustand for state management (normalized stores)
- tRPC client for HTTP API calls
- Raw WebSocket for real-time events
- mediasoup-client for voice/video
- Electron for desktop features
