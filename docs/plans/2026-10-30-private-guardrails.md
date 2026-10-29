# Private Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the `private/` UAT suite the same lint, layering, diagnosability, commit and leak guardrails as the public core.

**Architecture:** ESLint globs and a layer map extend to `private/src` and `private/tests`; Playwright keeps a trace for every failure; a tracked hook directory becomes the `private` repo's `core.hooksPath`; a private denylist feeds the existing `npm run guard`.

**Tech Stack:** ESLint 10 flat config, typescript-eslint, eslint-plugin-playwright, Playwright Test, Node 26 scripts, git hooks (`sh`).

**Spec:** the design approved in chat on 2026-10-30 (review gaps 1-4); its constraints are copied below.

## Global Constraints

- Public repo never holds UAT URLs, selectors, field names or data; the denylist content lives only in `private/guard.denylist.txt`.
- Every lint rule change gets a `scripts/verify-lint-rules.mjs` case that proves it fires, and a Decisions row in `docs/ARCHITECTURE.md`.
- `verify:lint` cases must pass on a clean clone without `private/` (CI) and leave no `private/` directory behind.
- `npm ci` in CI runs `prepare`; anything added to it must exit 0 without `private/`.
- Hooks must run on Windows (Git for Windows `sh`) and macOS; `.gitattributes` already forces `eol=lf`.
- One branch per change from `main` (`fix/`, `feat/`), merge commit, stage by explicit path, never `--no-verify`; `git push` only on the owner's explicit request.
- Definition of done per task: `npm run typecheck`, `npm run lint`, `npm run verify:lint`, `npm run guard`, `npm run test:unit`; `npm run test:stability` once at the end with the AUT up.

## Review Focus

- CI has no `private/`: the new private `verify:lint` cases must still pass and must not leave `private/` behind (Task 2, Step 6).
- CI `npm ci` runs `prepare` without `private/`: `setup-private-hooks.mjs` must print a skip and exit 0 (Task 3, Step 2).
- A private commit with no staged `.ts` file: the hook must not call `eslint` with no paths, which would lint the whole repo (Task 3, Step 6).
- A denylist pattern that matches an existing public file (e.g. bare `sandia` in `package.json`) would fail `guard` for every push: `guard` must pass right after the denylist is added (Task 4, Step 2).
- Existing UAT code that the new rules flag must be fixed in the `private` repo, never silenced with disable comments (Task 2, Step 5).

---

### Task 1: Trace on every failure

**Files:**
- Modify: `playwright.config.ts:22`
- Modify: `docs/ARCHITECTURE.md` (Decisions row D6)

**Interfaces:** none.

- [ ] **Step 1: Branch** — `git switch -c fix/trace-on-failure`.
- [ ] **Step 2: Prove today's gap** — add a throwaway `tests/unit/zz-trace-probe.spec.ts` with `test('probe', () => { expect(1).toBe(2); })`, run `npx playwright test --project=unit zz-trace-probe`. Expected: FAIL and no `trace.zip` under `test-results/*zz-trace-probe*`.
- [ ] **Step 3: Change** `trace: 'on-first-retry'` to `trace: 'retain-on-failure'`.
- [ ] **Step 4: Re-run the probe.** Expected: FAIL and a `trace.zip` exists in its `test-results` folder. Delete the probe file.
- [ ] **Step 5: Update D6** to "trace kept for every failure (`retain-on-failure`)" and add to its context: UAT traces contain the typed password, stay in gitignored `test-results/` and are never shared; `error-context.md` is safe to share.
- [ ] **Step 6: Definition of done**, then commit `fix(config): keep a trace for every failed test` with `playwright.config.ts docs/ARCHITECTURE.md`; merge to `main` with a merge commit.

### Task 2: Lint and layering for `private/`

**Files:**
- Modify: `eslint.config.ts`
- Modify: `scripts/verify-lint-rules.mjs`
- Modify: `docs/ARCHITECTURE.md` (Layering section, new Decisions row D11)
- Modify (private repo): whatever `npm run lint` flags

**Interfaces:**
- Produces: `restrict(files: string[], layers: Layer[], paths?: RestrictedPath[], uatLayers?: UatLayer[]): Linter.Config` with `type UatLayer = 'config' | 'components' | 'pages' | 'fixtures'`. `uatLayers` undefined = core file: bans all of `@uat` and `private/` (today's behaviour). `uatLayers` given = private file: bans only `@uat/src/<layer>` and `@uat/src/<layer>/*` for those layers, keeps the `@<layer>` core bans and the `../` ban.

- [ ] **Step 1: Branch** — `git switch -c fix/lint-private`.
- [ ] **Step 2: Write the failing cases** in `scripts/verify-lint-rules.mjs`:
  - `private tests ban waitForTimeout`: `private/tests/x.spec.ts`, code imports `test` from `@fixtures/conduit` and calls `page.waitForTimeout(1)`; expect `playwright/no-wait-for-timeout`.
  - `private tests must not import @playwright/test`: `private/tests/x.spec.ts`, `import { test, expect } from '@playwright/test'`; expect `@typescript-eslint/no-restricted-imports`.
  - `private pages must not import fixtures`: `private/src/pages/x.ts`, `import { test } from '@uat/src/fixtures/uat'`; expect `@typescript-eslint/no-restricted-imports`.
- [ ] **Step 3: Run** `npm run verify:lint`. Expected: the 3 new cases FAIL, the 12 old ones PASS.
- [ ] **Step 4: Implement** in `eslint.config.ts`: the Playwright rules block's `files` becomes `['tests/**/*.ts', 'private/tests/**/*.ts']`; extend `restrict` per the Interfaces block; add, after the core `restrict` calls:
  - `private/src/config/**`: core `['utils','api','components','data','pages','fixtures']`, uat `['components','pages','fixtures']`
  - `private/src/components/**`: core `['api','pages','fixtures']`, uat `['pages','fixtures']`, `[playwrightExpectOnly]`
  - `private/src/pages/**`: core `['fixtures']`, uat `['fixtures']`, `[playwrightExpectOnly]`
  - `private/src/fixtures/**`: core `[]`, uat `[]`, `[]`
  - `private/tests/**`: core `['api','components','pages']`, uat `['components','pages']`, `[playwrightBanned]`; change `playwrightBanned.message` to `Import test/expect from the AUT fixtures.`
- [ ] **Step 5: Run** `npm run verify:lint` (expected `15/15 lint rule checks passed`) and `npm run lint`. Fix every flagged UAT file in `private/` without disable comments; commit there `fix: satisfy the core lint rules` (explicit paths).
- [ ] **Step 6: Clean-clone check** — `git clone . <scratchpad>/clone && cd <scratchpad>/clone && npm ci && npm run verify:lint && test ! -e private`. Expected: `15/15` and exit 0.
- [ ] **Step 7: Docs** — Layering section: the same map applies to `private/src` and `private/tests` through `@uat/src/<layer>`; D11: "`private/` is linted with the core rules", enforcer `eslint.config.ts`, `verify:lint`.
- [ ] **Step 8: Definition of done**, commit `fix(lint): apply the Playwright and layering rules to private/` with `eslint.config.ts scripts/verify-lint-rules.mjs docs/ARCHITECTURE.md`; merge.

### Task 3: Git hooks for the `private` repo

**Files:**
- Create: `scripts/setup-private-hooks.mjs`
- Create: `scripts/private-hooks/pre-commit` (mode 755)
- Modify: `package.json` (`scripts.prepare`)
- Modify: `docs/ARCHITECTURE.md` (Private extension point, Decisions row D12)

**Interfaces:**
- Consumes: Task 2's lint coverage of `private/` (the hook is only as strong as those rules).

- [ ] **Step 1: Branch** — `git switch -c feat/private-hooks`.
- [ ] **Step 2: Write `setup-private-hooks.mjs`**: if `private/.git` exists, run `git -C private config core.hooksPath ../scripts/private-hooks` via `execFileSync` and print `private hooks: core.hooksPath set`; otherwise print `private hooks: no private/ repo, skipped`; exit 0 either way. Check both branches: run it here (set), and in the Task 2 scratch clone (skipped, exit 0).
- [ ] **Step 3: `prepare`** becomes `simple-git-hooks && node scripts/setup-private-hooks.mjs`.
- [ ] **Step 4: Write `scripts/private-hooks/pre-commit`** (`#!/bin/sh`, runs with cwd `private/`): collect staged `ACM` `*.ts` paths, prefix them with `private/`, `cd ..`, run `npm run typecheck`, then `npx eslint --max-warnings=0` on those paths only when the list is not empty; any failure exits non-zero. `git update-index --chmod=+x` after adding it.
- [ ] **Step 5: Blocks a bad commit** — in `private/`, add `tests/zz-hook-probe.spec.ts` that calls `page.waitForTimeout(1)`, `git -C private add` it, `git -C private commit -m probe`. Expected: commit refused with `playwright/no-wait-for-timeout`. Then `git -C private rm --cached tests/zz-hook-probe.spec.ts` and delete the file.
- [ ] **Step 6: Passes a commit with no `.ts`** — `git -C private commit --allow-empty -m probe`. Expected: typecheck runs, eslint is not called, the commit is created. Then `git -C private reset --soft HEAD~1`.
- [ ] **Step 7: Docs** — Private extension point: `npm install` points the `private` repo's hooks at `scripts/private-hooks`; D12 with enforcer `scripts/private-hooks/pre-commit`.
- [ ] **Step 8: Definition of done**, commit `feat(scripts): run typecheck and lint on private commits` with the 4 paths; merge.

### Task 4: Company denylist for the guard (private repo only)

**Files:**
- Create (private repo): `private/guard.denylist.txt`

**Interfaces:**
- Consumes: `scripts/guard.mjs` already merges `private/guard.denylist.txt` when it exists.

- [ ] **Step 1: Write the denylist**: one case-insensitive regex per line for the UAT host names in `private/.env` (`BASE_URL`, `API_URL`), the company name and the internal app names; not the bare word `sandia` (repo name).
- [ ] **Step 2: Run** `npm run guard`. Expected: `guard: ok (... 3 + N denylist patterns)`.
- [ ] **Step 3: Proves it fires** — create `docs/zz-guard-probe.md` containing one internal app name from the denylist, `git add -N docs/zz-guard-probe.md`, run `npm run guard`. Expected: exit 1 naming that file. Then `git rm --cached docs/zz-guard-probe.md` and delete it.
- [ ] **Step 4: Commit** in `private/`: `feat: add the company guard denylist` with `guard.denylist.txt` (the Task 3 hook runs).

### Wrap-up

- [ ] With Docker up: `npm run aut:up && npm run test:stability`. Expected: no failures, no flakes.
- [ ] Check that D6, D11 and D12 are in `docs/ARCHITECTURE.md`, then delete this plan in its own commit `docs: drop the executed private-guardrails plan`.
- [ ] Report to the owner: the UAT command to run on the office laptop is `npm run test:uat` (no change in behaviour expected), and `npm install` once there to set the private hooks.
