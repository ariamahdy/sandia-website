# Session Storage Reuse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A generic, unit-tested helper that captures and restores one origin's `sessionStorage`, so a private AUT that keeps its session there can sign in once per worker.

**Architecture:** Two functions in the fixtures layer. `captureSessionStorage` reads the page URL and its `sessionStorage`; `restoreSessionStorage` adds an init script to a browser context that writes those entries on that origin only, without overwriting a key the app has set since. The private repo's sign-in fixture uses them (its own plan); this plan adds no AUT knowledge.

**Tech Stack:** Playwright Test 1.64.1 (`page.evaluate`, `browserContext.addInitScript`, `page.route`), TypeScript.

**Spec:** design approved in chat on 2026-10-30 (option A1): Playwright's `storageState` covers cookies, localStorage and optionally IndexedDB, not `sessionStorage`; the Playwright docs restore it with `addInitScript`. That is the stated reason a built-in is insufficient (D1). Values stay in memory; nothing is written to disk.

## Global Constraints

- Core stays AUT-agnostic: no UAT host, app name or field name in code, tests or docs.
- Layering: the helper lives in `src/fixtures/`, imports only `@playwright/test` types.
- Unit tests run without Docker and without the network: the origin is a fake host served by `page.route`.
- No code comments, strict types, no `any`.

## Review Focus

- Restore on a different origin must not write anything (Task 1 test 3).
- A value the app changes after load must survive a reload (Task 1 test 4).
- An empty `sessionStorage` captures as `{}` and restores as a no-op (Task 1 test 1 variant).
- Keys and values with quotes or newlines must round-trip unchanged (Task 1 test 2 uses one).
- The helper must never log or attach values; only callers decide what to report.

---

### Task 1: `captureSessionStorage` and `restoreSessionStorage`

**Files:**
- Create: `src/fixtures/session-storage.ts`
- Test: `tests/unit/fixtures/session-storage.spec.ts`
- Modify: `docs/ARCHITECTURE.md` (Decisions D14, D7 wording)

**Interfaces:**
- Produces:
  - `type SessionSnapshot = { readonly url: string; readonly entries: Readonly<Record<string, string>> }`
  - `captureSessionStorage(page: Page): Promise<SessionSnapshot>`
  - `restoreSessionStorage(context: BrowserContext, snapshot: SessionSnapshot): Promise<void>`

- [ ] **Step 1: Branch** `feat/session-storage`.
- [ ] **Step 2: Write the failing tests** (each routes `https://app.test/**` to a tiny HTML page; a second host `https://other.test/**` for test 3):
  1. `captures the page url and its session storage`: set `a`=`1` and `b`=`x"y\nz` in the page, capture; expect `{ url: 'https://app.test/home', entries: { a: '1', b: 'x"y\nz' } }`. Variant in the same test: a fresh page captures `{}` entries.
  2. `restores the entries on the same origin in a new context`: capture from context 1, restore into context 2, open the URL; expect both keys with equal values.
  3. `does not write the entries on another origin`: restore, open `https://other.test/`; expect `sessionStorage.length` 0.
  4. `keeps a value the app changed after load`: restore, open the URL, set `a`=`2` in the page, reload; expect `a` is `2`.
- [ ] **Step 3: Run** `npm run test:unit -- session-storage`. Expected: FAIL, module not found.
- [ ] **Step 4: Implement** both functions in `src/fixtures/session-storage.ts`; the init script receives `{ origin, entries }`, returns early when `location.origin !== origin`, and calls `setItem` only for keys whose `getItem` is `null`.
- [ ] **Step 5: Run** `npm run test:unit`. Expected: all pass (37 + 4).
- [ ] **Step 6: Docs**: D14 "a private AUT that keeps its session in `sessionStorage` reuses it per worker through `captureSessionStorage`/`restoreSessionStorage`, in memory only, falling back to a UI sign-in when the AUT rejects it", enforcer `tests/unit/fixtures/session-storage.spec.ts`; D7 adds "mutating tests that depend on each other run in a `test.describe` with `mode: 'serial'`, so a failed first test skips its dependant".
- [ ] **Step 7: Definition of done** (typecheck, lint, verify:lint, guard, test:unit; `test:stability` with the AUT up), commit `feat(fixtures): capture and restore session storage per origin` with the 3 paths; merge.

### Wrap-up

- [ ] Delete this plan in its own commit `docs: drop the executed session-storage plan` after the private plan has run.
