# VoronoiServer

A real-time, multi-user collaborative Voronoi diagram. The server holds a single shared set of seed points; every connected client renders the same points and the Voronoi tessellation derived from them. Anyone can add a point (click-to-place) or delete an existing point — all changes are visible to all clients.

## Status

Early-stage. The web canvas renders the Voronoi tessellation for the current set of points (cells filled with each seed's color, dark cell boundaries, white-bordered seed markers). Adding points works end-to-end, but:

- There's no UI for deleting points yet — only the API procedure exists.
- Updates are pull-based (manual Refresh button) rather than pushed live. SSE-based realtime is the planned next step.
- Server state is in-memory; restarting the server clears all points.

## Stack

- pnpm + Turborepo monorepo
- `apps/web` — Next.js 16 (React 19) frontend and tRPC backend in one process
- `apps/mobile` — Expo SDK 52 (React Native) — skeleton only, requires Android Studio / Xcode / Expo Go to run
- `packages/api` — shared tRPC router consumed by both apps

## Quick start

Requires Node.js 20+ and pnpm.

```bash
pnpm install
pnpm dev --filter=web
```

Then open http://localhost:3000.

For the mobile app, run in a separate terminal (it uses an interactive Expo prompt):

```bash
pnpm dev --filter=mobile
```

## Project layout

```
apps/
  web/        Next.js app — frontend + tRPC API route
  mobile/     Expo app
packages/
  api/                  tRPC router (shared types)
  eslint-config/        shared ESLint config
  typescript-config/    shared tsconfig
```

## Development

Common tasks:

```bash
pnpm lint          # lint all packages
pnpm check-types   # type-check all packages
pnpm build         # production build
pnpm format        # apply Prettier formatting
```

See [CLAUDE.md](./CLAUDE.md) for architecture notes, conventions, and the current realtime/transport plan.
