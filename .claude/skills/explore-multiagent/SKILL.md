---
name: explore-multiagent
description: Decide whether a planned piece of work should run sequentially (one agent) or split across a parallel agent team — and if a team, design its structure. Produces a recommendation and a concrete hand-off plan; it does NOT spawn agents itself. Conservative and token-budget-aware by default. Trigger on "/explore-multiagent", "explore multiagent", "should I use subagents / an agent team", "parallelize this", or whenever planning something nontrivial.
---

# explore-multiagent (VoronoiServer)

A decision aid for one question: **for the work being planned, is a parallel agent team worth it, or should one agent do it sequentially?** If a team, this skill also designs its structure.

**What it does:** gathers context, decomposes the work, scores sequential-vs-team, and outputs a concrete plan.
**What it does NOT do:** it never spawns agents. It evaluates and hands off a plan. The user gives the final word; execution is triggered separately, after this skill ends.

## Default stance

- **Sequential is the default.** A team must *earn* its place; if the call is a wash, choose sequential — it's cheaper and simpler to reason about.
- **Budget-aware (load-bearing here).** This is a **$20 (Pro) account.** Spawning agents re-derives context from a cold start and multiplies token use — a parallel team runs ≈ 3–6× the tokens of one agent, and Anthropic's own research system ran ≈ 15×. Token usage explains most of the performance *and* the cost. So: when remaining tokens/context are **tight or unknown, push hard toward sequential.** Treat "unknown budget" as "tight." Wallclock savings are worthless if the session runs out mid-task.
- Spawning is the expensive path on this plan. Recommend it only when the *structure* of the work clearly pays for it.

## Step 1 — Understand what's actually being planned (ask first)

Don't analyze in a vacuum. Use **AskUserQuestion** to clarify before deciding. Cover:

- **The arc:** what do you want done **now** vs **later**? Separate the immediate task from the roadmap — they may have different answers.
- **Boundaries of the immediate task:** is this one feature, or several independent ones bundled together?
- **Which budget is tighter right now — time or tokens?** This single answer flips many decisions.
- **Hard constraints:** must-not-touch files, required ordering, external dependencies, anything in flight.
- **Remaining session budget/context**, if the user has a sense of it.

If context is missing, **ask — don't guess.** Lay out multiple options when the path genuinely forks.

## Step 2 — Decompose into a work graph

- List the concrete units of work.
- Draw the **dependency DAG**: which units consume another's output (edges = forced sequencing) vs which are independent (no edges = parallelizable candidates).
- Check **write-overlap**: do two units edit the same files? Overlap kills clean parallelism — it forces merges and reintroduces the coordination the team was meant to avoid.

## Step 3 — Score it

**Lean TEAM when several of these hold:**
- ≥3 genuinely **independent** workstreams (no shared files, no ordering between them).
- **Breadth-first** work whose total reading/output would blow a single context window — broad codebase sweeps, a migration spanning many *independent* files, bulk test generation across modules.
- **Time** is the binding constraint and **token budget is comfortable.**
- Each piece can be briefed **self-contained**, with a crisp, explicit output format.

**Lean SEQUENTIAL (default) when any of these hold:**
- Units are **coupled** — B needs A's result, or they touch the same files. *(This is most single-feature coding.)*
- The work is **small** — one agent finishes it in a few minutes.
- It's **exploratory** — you won't know step 2 until you see step 1's result.
- Token/context budget is **tight or unknown** ($20 plan: unknown ⇒ tight).
- The core is **tightly-interdependent coding** — multi-agent systems are weakest exactly here; they shine on parallel research, not entangled implementation.

Tie ⇒ sequential.

## Step 4 — If a team: design the structure

Use the **orchestrator-worker** pattern (Anthropic's research-system blueprint):

- **Orchestrator = the main thread (you).** It plans, splits, and *synthesizes/integrates*. **Workers never talk to each other** and don't know siblings exist — that isolation is what makes true parallelism safe.
- **Size:** prefer **≤4 workers**; ~4 is the usual ROI sweet spot. Each extra worker adds tokens and synthesis overhead.
- **Per-worker brief — each must be fully self-contained** (workers share no context):
  - objective, scope boundaries (**what NOT to touch**), inputs, and an **explicit output format**.
  - no dependence on another worker's mid-flight state.
- **Isolation for file-writing teams:** give each worker its own git worktree (`isolation: "worktree"`). **Never let two agents write the same files in the same tree.**
  - **⚠ Repo scar:** a past parallel-agent run here wrote **UTF-16 (BOM)** files that git flagged binary and refused to merge (`Cannot merge binary files: apps/mobile/app/index.tsx`). **Mandates:** (a) workers write **UTF-8** — no PowerShell `Out-File`/here-strings for source files; (b) any file *all* branches would touch (e.g. a shared screen) goes to **one** worker, never split across several.
  - This is a small monorepo (web + mobile + `packages/api`). Most single-feature changes are inherently coupled here → sequential. Teams fit broad *read* sweeps or genuinely file-disjoint batches, not typical feature work.
- **Model assignment to save tokens:** keep heavy reasoning on the orchestrator; scope focused, well-defined workers to a **cheaper model (Sonnet)**. Strong lever on a $20 plan.
- **Background vs foreground:** independent long-runners → `run_in_background`. Don't background work whose result you need immediately to proceed.

## Step 5 — Produce the hand-off plan (do NOT spawn)

Output a plan, not agents:

- **Recommendation:** `SEQUENTIAL` or `TEAM`, one line, with the deciding reasons.
- **If sequential:** the ordered step list.
- **If team:** the **roster** — for each worker: name, objective, files/scope, output format, model, isolation, background?; plus the **orchestrator's integration step** and the order things merge back.
- **Cost/benefit:** rough token multiplier and expected wallclock change, stated plainly so it can be weighed against budget.
- **Alternatives:** if a reasonable second shape exists (e.g. "2 workers not 4", or the **hybrid**: parallel research → then sequential implementation), lay it out so the user can choose.

## Step 6 — Final word before deploying

Present the plan and **explicitly ask the user to approve before any agent is launched.** This skill stops here — it does not spawn. On approval, execution is triggered separately. If the user adjusts the structure, fold it in and re-confirm.

## Red flags (stop and reconsider before recommending a team)

- "Several parts" / "be thorough" is **not** a parallelism signal — handle inline, sequentially.
- Coupled writes to shared files.
- Low or unknown budget.
- Vague or exploratory scope.
- A task one agent would finish in minutes.

---

*Heuristics grounded in:* [Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/built-multi-agent-research-system) (orchestrator-worker; parallel for breadth-first, weak for tightly-interdependent coding; ~15× tokens; self-contained subagent briefs) and 2026 Claude Code subagent guides ([claudefa.st](https://claudefa.st/blog/guide/agents/sub-agent-best-practices), [systemprompt.io cost guide](https://systemprompt.io/guides/claude-code-cost-optimisation)) (parallel only for independent/file-disjoint work; ~3–6× tokens; tight token budget ⇒ go sequential; ~4 workers best ROI; Opus orchestrator + Sonnet workers).
