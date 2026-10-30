# Guard and CI Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The guard also checks commits that are not on a remote yet, workflow actions are pinned by commit SHA, and Dependabot proposes updates.

**Architecture:** `scripts/guard.mjs` gains two checks next to the tracked-file scan: the added lines of every commit in `git rev-list HEAD --not --remotes`, and every `uses:` line in `.github/workflows/*.yml`. Both are covered by a new unit test that builds throwaway git repositories. Workflows pin each action to its full commit SHA with the version as a trailing comment; `.github/dependabot.yml` updates `npm` and `github-actions` weekly.

**Tech Stack:** Node 26 (`node:child_process`, `node:fs`), git, Playwright Test (unit project), GitHub Actions, Dependabot.

**Spec:** design approved in chat on 2026-10-30 (A1, B1, C).

## Global Constraints

- The guard never prints a matched line's content, only `<commit7> <file>: matches denylist pattern /<source>/` (history) or `<file>:<line>: ...` (as today).
- Denylist files themselves are skipped in the history scan, as in the tree scan.
- CI runs the guard on a clean clone where everything is pushed: the history scan finds 0 commits there and must pass.
- A repo with no commits, or with no remote, must not crash the guard: no commits means nothing to scan; no remote means every commit is unpushed.
- Action SHAs come from `gh api`, never from memory; each pin keeps its current version exactly.
- `typescript` is never proposed by Dependabot (D2).
- CLAUDE.md "no code comments" gets one exception: the version comment after a SHA-pinned `uses:` (owner-approved B1, 2026-10-30).

## Review Focus

- A term added in an unpushed commit and removed in a later unpushed commit must still fail the guard (Task 1 test 1).
- A term only in already-pushed commits must not fail the push (Task 1 test 2).
- A pin to a short SHA, a tag or a branch must fail; `./local-action` and `docker://` refs must pass (Task 2 tests).
- The guard must stay fast on this repo: report its run time before and after (Task 1 Step 6).
- The pre-push hook keeps running only `npm run guard`; nothing in the hook changes.

---

### Task 1: History scan in the guard

**Files:**
- Modify: `scripts/guard.mjs`
- Create: `tests/unit/scripts/guard.spec.ts`
- Modify: `docs/ARCHITECTURE.md` (Private extension point leak list, Decisions D15)

**Interfaces:**
- Produces: guard exit code 1 with a `<commit7> <file>: matches denylist pattern /<source>/` line per hit in an unpushed commit.

- [ ] **Step 1:** Branch `feat/guard-history`.
- [ ] **Step 2: Failing tests** in `tests/unit/scripts/guard.spec.ts`; a helper builds a temp repo with a bare remote, `scripts/guard.denylist.txt` holding `\bforbiddenterm\b`, and runs `node <repo>/scripts/guard.mjs` with that cwd:
  1. `fails on a term added and removed in unpushed commits`: push a clean commit; commit a file with `forbiddenterm`, then a commit removing it; expect exit 1 and one output line naming the first unpushed commit's short SHA and the file.
  2. `ignores a term that is only in pushed commits`: add and remove it, push both; expect exit 0.
  3. `passes a clean unpushed commit`: expect exit 0.
- [ ] **Step 3:** `npm run test:unit -- guard`. Expected: test 1 FAIL (exit 0), tests 2 and 3 PASS.
- [ ] **Step 4:** Implement in `guard.mjs`: if `git rev-parse --verify -q HEAD` fails, skip; else for each SHA of `git rev-list HEAD --not --remotes`, read `git show --format= --unified=0 --no-color <sha>`, track the file from `+++ b/<path>`, and test each added line (`+`, not `+++`) against the patterns; skip the denylist files.
- [ ] **Step 5:** `npm run test:unit`. Expected: all pass.
- [ ] **Step 6:** `time npm run guard` on this repo before and after the change; both under 2 s.
- [ ] **Step 7:** Docs: leak list gets "the guard also scans the added lines of commits not on a remote yet"; D15 with enforcer `tests/unit/scripts/guard.spec.ts`.
- [ ] **Step 8:** Definition of done; commit `feat(scripts): scan unpushed commits in the guard`; merge.

### Task 2: SHA-pinned actions

**Files:**
- Modify: `scripts/guard.mjs`, `tests/unit/scripts/guard.spec.ts`
- Modify: `.github/workflows/ci.yml`, `.github/workflows/stability.yml`
- Modify: `CLAUDE.md` (the comment rule), `docs/ARCHITECTURE.md` (D16)

- [ ] **Step 1:** Branch `build/pin-actions-sha`.
- [ ] **Step 2: Failing tests**: `fails on an action pinned by tag` (`uses: actions/checkout@v7.0.1` in a tracked workflow → exit 1, line names the file and line); `passes an action pinned by a 40-character SHA` (with `# v7.0.1` after it); `passes local and docker actions` (`./x`, `docker://alpine:3`).
- [ ] **Step 3:** Run them: the tag test FAILS.
- [ ] **Step 4:** Implement: for tracked `.github/workflows/*.yml`, every `uses: <ref>` whose ref is not `./...` or `docker://...` must end in `@[0-9a-f]{40}`.
- [ ] **Step 5:** Resolve each action's SHA: `gh api repos/<owner>/<repo>/git/ref/tags/<tag>`, and if the object is an annotated tag, `gh api repos/<owner>/<repo>/git/tags/<sha>` to get the commit. Replace every `uses:` with `<owner>/<repo>@<commit-sha> # <tag>`.
- [ ] **Step 6:** `npm run guard` passes on this repo; `npm run test:unit` passes.
- [ ] **Step 7:** CLAUDE.md: "Strict types, no `any`, ESLint-clean, compact, no code comments (one exception: the version comment after a SHA-pinned action, D16)." D16 with enforcer `scripts/guard.mjs` + its test.
- [ ] **Step 8:** Definition of done; commit `build(ci): pin workflow actions to commit SHAs`; merge.

### Task 3: Dependabot

**Files:**
- Create: `.github/dependabot.yml`
- Modify: `docs/ARCHITECTURE.md` (D17, remove R4)

- [ ] **Step 1:** Branch `build/dependabot`.
- [ ] **Step 2:** `version: 2`; `updates`: `npm` at `/`, weekly, `versioning-strategy: increase`, `ignore: [{ dependency-name: typescript }]`; `github-actions` at `/`, weekly.
- [ ] **Step 3:** There is no local validator for `dependabot.yml`: check each key against GitHub's configuration reference and report the file as unverified until GitHub reads it after the push.
- [ ] **Step 4:** D17 "Dependabot proposes one PR per dependency or action, weekly; TypeScript is ignored (D2)", enforcer `.github/dependabot.yml`; delete R4.
- [ ] **Step 5:** Definition of done; commit `build(ci): add Dependabot for npm and actions`; merge.

### Wrap-up

- [ ] After the owner pushes: CI is green with the SHA pins, and Dependabot's first run appears under Insights → Dependency graph → Dependabot.
- [ ] Delete this plan in its own commit `docs: drop the executed guard-and-ci-hardening plan`.
