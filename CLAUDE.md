# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

VoronoiServer is a real-time, multi-user collaborative Voronoi diagram. The server holds one global set of seed points on a plane; every connected client renders the same set of points and the Voronoi tessellation derived from them, updated live as anyone makes changes.

**Shared state:** a set of points on a plane. Each point has a color attribute (chosen by the user who created it, or random) and that color is global — everyone sees the same colors.

**User actions (concurrent, free-for-all):**
1. Add a point — click-to-place within the bounded plane. No other constraints (no dedup, no per-user limits).
2. Delete an existing point — any user can delete any point, regardless of who created it.

**Realtime:** mutations propagate to all connected clients within a poll interval (~1.5s); your own edits appear immediately. See the Realtime (polling) section below.

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

# Run unit tests (vitest; currently the mobile geometry/colour helpers)
pnpm test

# Format
pnpm format

# Install dependencies
pnpm install

# Database (Prisma + MySQL). Run from packages/api or via the filter.
pnpm --filter @repo/api db:generate   # regenerate the Prisma client after schema edits
pnpm --filter @repo/api db:migrate    # create/apply a migration (prisma migrate dev)
```

A `DATABASE_URL` (MySQL connection string) must be set for any DB command or for the
running server. Put it in `packages/api/.env` (for the Prisma CLI) and `apps/web/.env.local`
(for the Next.js runtime). Both are gitignored.

Mobile (`apps/mobile`) uses `expo start` under the hood, which is interactive. It must be run separately from the Turbo dev task.

For interactive UI verification (modifier keys, hover, clicks), drive the running web app with `node apps/web/scripts/screenshot.mjs <out-dir>` — the static `playwright screenshot` CLI can't simulate input. Extend that script for new interactive states rather than re-inventing it.

## Architecture

This is a pnpm + Turborepo monorepo with two apps and three shared packages.

### Apps

**`apps/web`** — Next.js 16 (React 19). Serves both the frontend and the tRPC backend. The API lives at `app/api/trpc/[trpc]/route.ts` using Next.js route handlers. The frontend connects to it via a relative URL (`/api/trpc`), so there is no separate backend process.

**`apps/mobile`** — Expo SDK 54 (React 19, React Native 0.81) with Expo Router. Connects to the `apps/web` tRPC endpoint at `http://localhost:3000/api/trpc`. Metro is configured in `metro.config.js` to watch the monorepo root so it can resolve workspace packages. Pure helpers (letterbox coordinate mapping, nearest-seed lookup, HSL palette math) live in `apps/mobile/utils/` with colocated `*.test.ts` vitest specs.

### Packages

**`packages/api`** — The only truly shared code. Defines the tRPC router (`src/root.ts`) and exports `appRouter` and the `AppRouter` type. Both apps import from here. New API procedures go in `src/root.ts`; the type is automatically available to both frontends. Persistence also lives here: the Prisma schema (`prisma/schema.prisma`), the PrismaClient singleton (`src/db.ts`), and the data-access layer (`src/store.ts`).

**`packages/eslint-config`** and **`packages/typescript-config`** — Shared tooling config extended by both apps. No application logic.

### tRPC data flow

1. Add a procedure to `packages/api/src/root.ts`
2. `apps/web` serves it automatically via the existing route handler
3. Both `apps/web` and `apps/mobile` can call it using the `trpc` client exported from their respective `utils/trpc.ts`
4. React Query providers are set up in `apps/web/app/providers.tsx` and `apps/mobile/app/_layout.tsx`

### Realtime (polling)

Clients stay in sync by polling, not pushing. Both frontends call `getPoints` with React Query's `refetchInterval` (1500ms), so another client's add/delete shows up within a tick. Mutations additionally `invalidate` `getPoints` on success (`apps/web/app/page.tsx`, `apps/mobile/app/index.tsx`), so your own edits appear immediately instead of waiting for the next poll. The store (`packages/api/src/store.ts`) reads from the shared database on demand — there is no event emitter.

This pull model is deliberately serverless-friendly: it has no long-lived connections, so it works unchanged across ephemeral, multi-instance hosting (e.g. Vercel). It replaced an earlier SSE transport (server-emitter + `EventSource`), which couldn't survive serverless's stateless, per-instance model. The tradeoff is latency (bounded by the interval) and steady polling traffic in exchange for that simplicity.

### Persistence (Prisma + MySQL)

Shared state lives in a MySQL database (TiDB Serverless), accessed through Prisma. This is what makes the polling model actually correct on serverless: every stateless instance reads/writes the same database rather than its own module memory (the previous in-memory `Map` could not survive multi-instance, ephemeral hosting).

- **Schema:** `packages/api/prisma/schema.prisma` — one `Point` model (`id`, `x`, `y`, `color`).
- **Client:** `packages/api/src/db.ts` exports a `PrismaClient` singleton (reused across hot reloads / warm invocations so the connection pool isn't exhausted).
- **Data access:** `packages/api/src/store.ts` wraps Prisma in `list` / `add` / `remove`. The `Point` *contract type* is hand-defined there (not Prisma's generated type), so the frontends don't depend on Prisma. `remove` uses `deleteMany` so deleting an already-gone id is a no-op (idempotent, tolerant of concurrent deletes).
- **Config:** `DATABASE_URL` env var (see Commands above). Prisma client is regenerated on install via the `postinstall` script.
- **Inspecting the DB:** a local MCP server (`@benborla29/mcp-server-mysql`, read-only) can be pointed at the database for ad-hoc `SELECT`s. Copy `.mcp.json.example` to `.mcp.json` (gitignored — it holds credentials), fill in the TiDB host/user/password, and restart Claude Code to load it.

### Key constraints

- `node-linker=hoisted` is set in `.npmrc` globally — required for Expo/React Native to resolve dependencies correctly with pnpm.
- Both apps run React 19. (Mobile was on React 18 under Expo SDK 52; the SDK 54 upgrade brought it to parity.)
- `packages/ui` does not exist — UI components are not shared between web and mobile due to incompatible rendering primitives (HTML vs native).
