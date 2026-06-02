---
name: lint-llm-slop
description: Audit VoronoiServer for LLM-style code verbosity and simplify with strict parity verification. Prioritizes files edited since the last cleanup (tracked via .claude/llm-slop-baseline). Trigger on "lint llm slop", "remove llm slop", "clean up codebase", "audit for verbosity".
---

# lint-llm-slop (VoronoiServer)

Project-tuned wrapper of the universal `lint-llm-slop` skill. Same procedure, same slop catalog — but with this repo's verification commands and conventions baked in.

## Required reading

Before scanning, also read `~/.claude/skills/lint-llm-slop/SKILL.md` for the full slop catalog and step-by-step procedure. The user-level skill is the source of truth for *what* counts as slop. This file pins *how* we verify parity here.

## Verification commands (this repo)

After applying simplifications, run these gates from the repo root:

```bash
pnpm turbo run lint check-types
```

Turbo parallelizes across packages — sequential `pnpm lint; pnpm check-types` wastes ~60s.

### The known false-positive

`pnpm check-types` on `apps/web` may fail locally with `Type 'bigint' is not assignable to type 'ReactNode'` in `app/providers.tsx`. **This is a stale-`node_modules` artifact** of the hoisted-linker + React-version-skew situation, not a real type error. Don't waste time chasing it.

To confirm: re-run the type-check inside the persistent verification worktree at `./wt-verify` (gitignored, set up per the `ship` skill). **`wt-verify` is authoritative when local results disagree.**

If a clean install reproduces the error, *that* is a regression and worth investigating. Otherwise, ignore the local symptom.

### When to use wt-verify for this skill

Most slop simplifications are intra-file edits that don't affect type resolution across packages. The local check is fine.

Use `wt-verify` when:
- The diff touches `packages/api/src/` exports (the public type surface for both apps)
- Any `package.json`, `pnpm-lock.yaml`, or `tsconfig*.json` is touched
- Local check-types fails and you want to know if it's the known false-positive

## UI verification

For changes to `apps/web/app/**` that affect rendered output, drive the live app with:

```bash
node apps/web/scripts/screenshot.mjs <out-dir>
```

The static `playwright screenshot` CLI **cannot** simulate input (modifier keys, hover, clicks). Extend `screenshot.mjs` with new states if needed — don't reinvent.

Capture before/after screenshots and compare. Don't claim UI parity without a visual check; if you can't run the screenshot script, say so explicitly in the report.

## State file

`.claude/llm-slop-baseline` (committed, in repo root). One line: the commit SHA this skill last cleaned through.

- Missing → first run; confirm full-repo scope with the user before proceeding.
- Present → scope is `git diff <sha>..HEAD --name-only`, filtered to source files (see below).

## Scope filters

Source files only:
- `apps/**/*.{ts,tsx,js,mjs}`
- `packages/**/*.{ts,tsx,js}`

Skip:
- `node_modules/`, `.next/`, `.expo/`, `dist/`, `build/`
- `pnpm-lock.yaml`, `**/*.d.ts` if generated
- `wt-verify/` (it's a git worktree, not source — would double-count)
- `apps/web/scripts/screenshot.mjs` *(judgment: this is operational tooling, not product code; flag suggestions but don't auto-edit unless user opts in)*

## Repo conventions to respect

These shape what counts as slop *here*:

- **No comments by default** (per `CLAUDE.md`). Be especially aggressive about removing redundant/restate-the-code comments. Keep only WHY-comments for non-obvious constraints.
- **React 19 on web, React 18 on mobile** (Expo SDK 52 constraint). Don't suggest React-19-only patterns in `apps/mobile`.
- **No shared UI package** — incompatible primitives (HTML vs native). Don't propose extracting components across `apps/web` and `apps/mobile`.
- **No test runner**. Don't suggest test-related cleanups; there's nothing to break.
- **tRPC procedures live in `packages/api/src/root.ts`**. Don't reorganize procedures or types unprompted — both apps depend on these.
- **State is an in-memory map, single-process by design** (`packages/api/src/store.ts`). Don't flag the in-memory store as "should be a service" or "needs a database" — that's deferred infrastructure, not slop.
- **`node-linker=hoisted`** is required for Expo + pnpm. Don't suggest `.npmrc` changes.

## Aggressiveness

**Aggressive** by default — apply both **[C]** and **[A]** patterns from the catalog. The user picked this level; honor it.

Skip and surface (don't auto-apply) when uncertain:
- Removing `useEffect` in favor of derived state — the canvas-render and key-listener effects have lifecycle subtleties that are easy to break.
- Deleting exports from `packages/api` — the mobile app may consume them even if web doesn't.
- Renaming public-facing identifiers in `packages/api/src/root.ts`.

## Reporting

Use the report format from the user-level skill. Add one extra line:

```
wt-verify check: <ran | skipped, reason>
```

so the user can see at a glance whether the authoritative type-check ran.

The user reviews the diff and decides whether to commit/PR. **Do not commit without explicit confirmation.** If the user says "ship it," hand off to the `ship` skill rather than committing inline.
