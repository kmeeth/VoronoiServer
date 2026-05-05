# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

VoronoiServer is a real-time, multi-user collaborative Voronoi diagram. The server holds one global set of seed points on a plane; every connected client renders the same set of points and the Voronoi tessellation derived from them, updated live as anyone makes changes.

**Shared state:** a set of points on a plane. Each point has a color attribute (chosen by the user who created it, or random) and that color is global — everyone sees the same colors.

**User actions (concurrent, free-for-all):**
1. Add a point — click-to-place within the bounded plane. No other constraints (no dedup, no per-user limits).
2. Delete an existing point — any user can delete any point, regardless of who created it.

**Realtime:** mutations propagate to all connected clients instantly.

## Commands

```bash
# Run all apps in dev mode
pnpm dev

# Run a single app
pnpm dev --filter=web
pnpm dev --filter=mobile   # interactive; run separately from web

# Build / lint / type-check all
pnpm build
pnpm lint
pnpm check-types

# Format
pnpm format

# Install dependencies
pnpm install
```

Mobile (`apps/mobile`) uses `expo start` under the hood, which is interactive. It must be run separately from the Turbo dev task.

For interactive UI verification (modifier keys, hover, clicks), drive the running web app with `node apps/web/scripts/screenshot.mjs <out-dir>` — the static `playwright screenshot` CLI can't simulate input. Extend that script for new interactive states rather than re-inventing it.

## Architecture

This is a pnpm + Turborepo monorepo with two apps and three shared packages.

### Apps

**`apps/web`** — Next.js 16 (React 19). Serves both the frontend and the tRPC backend. The API lives at `app/api/trpc/[trpc]/route.ts` using Next.js route handlers. The frontend connects to it via a relative URL (`/api/trpc`), so there is no separate backend process.

**`apps/mobile`** — Expo SDK 52 (React 18, React Native 0.76) with Expo Router. Connects to the `apps/web` tRPC endpoint at `http://localhost:3000/api/trpc`. Metro is configured in `metro.config.js` to watch the monorepo root so it can resolve workspace packages.

### Packages

**`packages/api`** — The only truly shared code. Defines the tRPC router (`src/root.ts`) and exports `appRouter` and the `AppRouter` type. Both apps import from here. New API procedures go in `src/root.ts`; the type is automatically available to both frontends.

**`packages/eslint-config`** and **`packages/typescript-config`** — Shared tooling config extended by both apps. No application logic.

### tRPC data flow

1. Add a procedure to `packages/api/src/root.ts`
2. `apps/web` serves it automatically via the existing route handler
3. Both `apps/web` and `apps/mobile` can call it using the `trpc` client exported from their respective `utils/trpc.ts`
4. React Query providers are set up in `apps/web/app/providers.tsx` and `apps/mobile/app/_layout.tsx`

### Realtime (SSE)

Mutations propagate live via Server-Sent Events. The store (`packages/api/src/store.ts`) emits events on `add`/`remove`; the route at `apps/web/app/api/events/route.ts` streams a `snapshot` on connect followed by `added`/`removed` events. The web client opens an `EventSource` and writes directly into the React Query cache for `getPoints` (`apps/web/app/page.tsx`). Mutations are fire-and-forget — the SSE echo is the source of truth, so clients never diverge from the server.

Single-process only: the emitter lives in module memory. Multi-instance fan-out (Redis pub/sub, etc.) is deferred until there's a reason to scale horizontally.

### Key constraints

- `node-linker=hoisted` is set in `.npmrc` globally — required for Expo/React Native to resolve dependencies correctly with pnpm.
- React version differs between apps: web uses React 19, mobile uses React 18 (Expo SDK 52 constraint).
- `packages/ui` does not exist — UI components are not shared between web and mobile due to incompatible rendering primitives (HTML vs native).
