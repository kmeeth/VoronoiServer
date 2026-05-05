---
name: ship
description: Ship the current branch as a PR — run lint and type-check (verifying in a clean worktree when it matters), screenshot-test any UI change, distinguish pre-existing errors from regressions you introduced, commit, push, and open the PR. Trigger on "ship", "raise/open a PR", or after the user confirms a feature is done. Do NOT use for one-line doc edits where lint/types/UI verification adds no value — ship those manually.
---

# Ship a PR

The point of this skill: never ask the user to verify something you can verify yourself. No "could you click around and tell me if it works?" No "I think this passes type-check on your machine." Run the checks. Look at the screenshot. Compare. Fix. Then open the PR.

If a step would be wasted on this particular change (e.g. screenshotting a README edit), say so and skip it deliberately — but skip on purpose, not by accident.

## 1. Establish baseline first

Before claiming any check passed *because of your change*, know what was already broken on `main`. If you don't already know the pre-existing failures for this repo from a recent run, check `main` (clean worktree if needed — see §3) and write the failures down. Anything appearing in your branch but not in `main` is a regression *you* introduced and must fix before opening the PR.

## 2. Run the local checks

Run lint and type-check together so Turbo parallelizes them across packages — sequential `pnpm lint; pnpm check-types` wastes ~60s per ship.

```bash
pnpm turbo run lint check-types
```

Compare output to baseline. Don't shrug off new errors as "probably pre-existing" — verify.

## 3. Verify in a clean worktree when types or installs are involved

This repo uses `node-linker=hoisted` (Expo + pnpm constraint). With React 18 on mobile and React 19 on web, long-lived `node_modules` resolve types non-deterministically — `pnpm check-types` on the local install can pass while a fresh checkout fails, or vice versa.

**Decide whether you need this step.** Judge from the diff: does the change plausibly affect how the type system resolves modules? Pure app code (a component, a page, a route handler that doesn't change exports) does *not* — skip the clean-worktree check, it's 5+ minutes of nothing. If you're not sure, fall back to this trigger list and run the check when **any** of these are touched:

- `packages/api/src/index.ts` or its public type surface (anything `appRouter` exposes)
- any `package.json` (deps, devDeps, scripts that affect tooling)
- `pnpm-lock.yaml`
- any `tsconfig*.json` or `packages/typescript-config/**`
- `.npmrc`

When you do run it, use the **persistent** verification worktree at `D:/wt-verify` so subsequent ships skip the install cost. First-time setup (one-off, ~5 min):

```bash
git worktree add -f --detach D:/wt-verify
cd D:/wt-verify && pnpm install
```

For each ship that needs the check (~10s if lockfile unchanged, ~30s with delta):

```bash
cd D:/wt-verify && git fetch origin && git checkout --detach origin/<branch-name>
cd D:/wt-verify && pnpm install
cd D:/wt-verify && pnpm turbo run lint check-types
```

`--detach` keeps the worktree off any named branch so it doesn't conflict with the active checkout in the main worktree. Treat the verification worktree's result as authoritative when local and clean disagree.

Do **not** remove `D:/wt-verify` after — leave it parked. It's reused next ship.

For pure markdown / config edits, skip this entirely — there's nothing for the type system to disagree with.

## 4. UI changes: see them, don't guess

If the change affects what's rendered in the browser, do not ship without looking at it. Start the dev server, drive the page, screenshot, compare to expectation.

### 4a. Write down expectations *before* you look

Before taking the screenshot, write a short list of what should be true visually. e.g.:

- 4 Voronoi cells, distinct colors
- Dark cell boundaries
- White-filled seed markers with dark borders, one per point
- No overflow past the canvas border

This is the rubric. Without it, "it looks fine" means nothing.

### 4b. Start the dev server

```bash
pnpm dev --filter=web   # run_in_background: true
until curl -sf -o /dev/null http://localhost:3000/; do sleep 1; done
```

### 4c. Seed deterministic state

Empty canvas isn't informative. Seed via tRPC so the screenshot is reproducible:

```bash
curl -s -X POST 'http://localhost:3000/api/trpc/addPoint' -H 'Content-Type: application/json' -d '{"x":150,"y":150,"color":"hsl(0,70%,50%)"}'
curl -s -X POST 'http://localhost:3000/api/trpc/addPoint' -H 'Content-Type: application/json' -d '{"x":600,"y":200,"color":"hsl(120,70%,50%)"}'
curl -s -X POST 'http://localhost:3000/api/trpc/addPoint' -H 'Content-Type: application/json' -d '{"x":400,"y":450,"color":"hsl(240,70%,50%)"}'
curl -s -X POST 'http://localhost:3000/api/trpc/addPoint' -H 'Content-Type: application/json' -d '{"x":200,"y":500,"color":"hsl(60,70%,50%)"}'
```

For a clean baseline, delete all points first:

```bash
node -e "fetch('http://localhost:3000/api/trpc/getPoints').then(r=>r.json()).then(j=>Promise.all(j.result.data.map(p=>fetch('http://localhost:3000/api/trpc/deletePoint',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:p.id})}))))"
```

### 4d. Screenshot

```bash
pnpm dlx playwright screenshot --browser=chromium --viewport-size=900,700 --wait-for-timeout=500 http://localhost:3000 screenshot.png
```

First run will install the chromium binary (one-time, cached per-user). Read `screenshot.png` with the `Read` tool — you will see it.

### 4e. Compare to expectations, iterate

Walk down your rubric line by line. For each item: matched / mismatched. If anything is mismatched, fix the code, retake the screenshot, re-compare. Do not declare success until the screenshot satisfies the rubric.

If the change requires user interaction (clicks, modifier keys, drag), the static-screenshot CLI isn't enough. Add `playwright` as a `devDependency` in `apps/web` and write a small driver script (`scripts/screenshot.mjs` checked into the PR is fine if it's worth keeping). One-time cost; reuse it for every interactive change after.

### 4f. Check the dev server log for runtime errors

```bash
# Read the background task's output file (the path was returned when you started it)
tail -50 <dev-server-log-path>
```

Look for non-200 responses, stack traces, hydration warnings, React-key warnings, unhandled promise rejections. Clean log doesn't prove correctness, but a noisy log proves *something* is wrong.

## 5. Clean up before committing

Don't ship temporary state.

```bash
# Kill the dev server (port 3000)
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

Leave `D:/wt-verify` alone — it's persistent (see §3). Delete `screenshot.png` and any other scratch files. `git status` should show only the intentional changes.

## 6. Commit

```bash
git add <specific files>   # avoid `git add -A` — it can pick up scratch
git commit -m "$(cat <<'EOF'
Imperative subject line

Body explaining *why* the change exists. The diff shows what changed;
the message explains motivation, tradeoffs, or context that wouldn't
be obvious from reading the code.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

## 7. Push and open the PR

```bash
git push -u origin <branch-name>
gh pr create --title "<short, under 70 chars>" --body "$(cat <<'EOF'
## Summary
- 1–3 bullets on rationale, not a diff retelling

## Test plan
- [x] Each verification you actually did — lint, clean-worktree check-types, screenshot-checked against rubric, dev server log clean, etc. Be specific.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

The test plan is not boilerplate. If you didn't run a clean-worktree check, don't list it. If you didn't screenshot, don't claim you did. The user reads this.

## 8. Stop

Do not merge. Wait for the user to say merge.

After they say merge:

```bash
gh pr merge <num> --squash --delete-branch
git checkout main && git pull --ff-only
```

Update project memory only if a load-bearing fact about the project changed (new feature shipped end-to-end, planned PR sequence shifted, structural decision recorded). Do not log every PR — `git log` is the source of truth for that.
