# Error Share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make masking the default when a failure is handed over: one command collects every Playwright error file of the last run, masks it and keeps it outside `test-results/`.

**Architecture:** `scripts/mask-snapshot.mjs` exports its masking as a function (`maskSnapshot(text)`) and keeps its CLI. A new `scripts/error-share.mjs` empties `shared-errors/` (gitignored), finds every `error-context.md` under `test-results/`, writes each masked copy as `shared-errors/<test folder>.md`, and prints one line per file with its masked count. `npm run error:share` runs it on Windows and macOS.

**Tech Stack:** Node 26 (`node:fs`, `node:path`), Playwright Test for the unit tests, no new dependency.

**Spec:** re-audit gap 2, approved in chat on 2026-11-01.

## Global Constraints

- No AUT detail in core: tests use invented data only.
- `shared-errors/` is gitignored; guard keeps failing on any tracked file there.
- A run without error files prints that and exits 0; a missing `test-results/` exits 0 with the same message.
- Traces, screenshots and videos are never copied.

---

### Task 1: Masking as a function

- [ ] `tests/unit/scripts/mask-snapshot.spec.ts` keeps passing; add a test that imports `maskSnapshot` and gets `{ text, masked }`.
- [ ] Move the logic of `mask-snapshot.mjs` into an exported `maskSnapshot`; the CLI calls it. Commit `refactor(scripts): export the snapshot masking as a function`.

### Task 2: error:share

- [ ] RED `tests/unit/scripts/error-share.spec.ts` (temp dir as cwd): two test folders with `error-context.md` and one with only a trace; after the run `shared-errors/` holds exactly two masked `.md` files, no trace; an old file in `shared-errors/` is gone; no `test-results/` prints "no error files".
- [ ] `scripts/error-share.mjs`, `npm run error:share`, `.gitignore` entry; GREEN; typecheck, lint, guard, unit; commit `feat(scripts): collect and mask the error files of the last run`.

### Task 3: Docs

- [ ] D19 names `error:share` as the way to hand over failures; README row. Commit `docs: hand over failures with npm run error:share`.

### Wrap-up

- [ ] Merge with a merge commit; drop this plan in its own commit.
