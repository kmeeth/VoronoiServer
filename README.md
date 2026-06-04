# VoronoiServer

A real-time, multi-user collaborative Voronoi diagram. The server holds a single shared set of seed points; every connected client renders the same points and the Voronoi tessellation derived from them. Anyone can add a point (click-to-place) or delete an existing point — all changes are visible to all clients.

## Status

The web canvas renders the Voronoi tessellation for the current set of points (cells filled with each seed's color, dark cell boundaries, white-bordered seed markers). Adding (click) and deleting (shift-click) work end-to-end. Your own edits apply **optimistically** — the canvas updates the instant you click, before the server write completes — while other clients' changes arrive within ~1.5s via polling. The mobile client is at parity: tap to add, long-press to delete (with a delete-target preview), palette and custom HSL color pickers, and the same live updates.

**Live:** deployed on Vercel at https://voronoi-server-web.vercel.app.

Notes:

- Server state is persisted in a MySQL database (TiDB Serverless) via Prisma, so points survive restarts and are shared across instances — this is what makes serverless (Vercel) deployment viable.
- Running the server (or any DB command) requires a `DATABASE_URL` MySQL connection string. See [CLAUDE.md](./CLAUDE.md) for where it goes.

## Stack

- pnpm + Turborepo monorepo
- `apps/web` — Next.js 16 (React 19) frontend and tRPC backend in one process
- `apps/mobile` — Expo SDK 54 (React 19, React Native) — at parity with the web client; requires Android Studio / Xcode / Expo Go to run
- `packages/api` — shared tRPC router consumed by both apps; also owns persistence (Prisma + MySQL)

## Quick start

Requires Node.js 20+ and pnpm, plus a `DATABASE_URL` (MySQL connection string) — put it in `packages/api/.env` and `apps/web/.env.local` (both gitignored). See [CLAUDE.md](./CLAUDE.md) for details.

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
pnpm test          # run unit tests (vitest)
pnpm build         # production build
pnpm format        # apply Prettier formatting
```

See [CLAUDE.md](./CLAUDE.md) for architecture, persistence, realtime, and deployment notes plus conventions.
