# Private Pre-Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-audit gap 6: the `private` repo gets a pre-push check that stops the most damaging slips before they reach its remote.

**Architecture:** `scripts/private-guard.mjs`, run with the private repo as working directory, fails when (a) a tracked path is an env file other than `.env.example`, a `*.zip`, or lies under `test-results/`, `shared-errors/`, `playwright-report/`, `blob-report/` or `.auth/`; (b) an added line in a commit not on `origin` yet contains the value of `AUTH_PASSWORD` from the private `.env` (skipped when unset or shorter than 6 characters; the value is never printed, a hit names the commit and file only). `scripts/private-hooks/pre-push` runs it; `setup-private-hooks.mjs` already points `core.hooksPath` there.

**Tech Stack:** Node 26 (`node:child_process`, `node:fs`), git, Playwright Test unit tests with temp repos (as `guard.spec.ts`).

**Spec:** re-audit gap 6, approved in chat on 2026-11-01.

## Global Constraints

- No AUT detail in core; tests use invented paths and an invented password.
- Reads the private `.env` itself (no `--env-file`), since a pre-push runs without npm.
- Exit 0 with one `private-guard: ok (...)` line; exit 1 with one line per problem.

---

### Task 1: Tests

- [ ] RED `tests/unit/scripts/private-guard.spec.ts` with a temp repo plus bare remote: clean repo passes; tracked `.env` fails, `.env.example` passes; tracked `test-results/x/trace.zip` and `shared-errors/a.md` fail; an unpushed commit adding the password fails without printing it; the same line already pushed passes; no `.env` passes with a note.

### Task 2: Script and hook

- [ ] `scripts/private-guard.mjs`, `scripts/private-hooks/pre-push` (`cd .. && node scripts/private-guard.mjs` with cwd private); GREEN; typecheck, lint, guard, unit; check without `private/`; commit `feat(scripts): add a pre-push guard for the private repo`.

### Task 3: Docs

- [ ] D22 (context: the private repo had only a pre-commit, no leak check; decision: the guard above; enforcer: `tests/unit/scripts/private-guard.spec.ts`, private pre-push); hooks line in "Private extension point". Commit.

### Wrap-up

- [ ] Prove it once on a throwaway private branch (a tracked dummy `test-results/x.md` blocks the push, without pushing); merge; drop this plan.
