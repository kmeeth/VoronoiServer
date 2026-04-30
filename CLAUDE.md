# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

### Key constraints

- `node-linker=hoisted` is set in `.npmrc` globally — required for Expo/React Native to resolve dependencies correctly with pnpm.
- React version differs between apps: web uses React 19, mobile uses React 18 (Expo SDK 52 constraint).
- `packages/ui` does not exist — UI components are not shared between web and mobile due to incompatible rendering primitives (HTML vs native).
