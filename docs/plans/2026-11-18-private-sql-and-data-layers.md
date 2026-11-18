# Private SQL Server access and data/api layers

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** let private tests read values that the private AUT only stores in its SQL Server database (one-time codes, generated passwords) and build their own dummy data, without breaking the layering.

**Architecture:** `mssql` becomes a dependency of the core repo (it owns `package.json`). `private/` gets the two core layers it lacks: `private/src/data` (pure test-data builders) and `private/src/api` (AUT back-end clients, here SQL Server), with the same rank as in the core: `config <- data <- api/components <- pages <- fixtures`. No core code uses `mssql`.

## Global Constraints

- Versions verified on the npm registry on 2026-11-18: `mssql` 12.7.14 (2026-11-04), `@types/mssql` 12.3.0 (2026-04-16; `mssql` ships no types), `tedious` held at 20.3.8 (2026-10-11) through `overrides`, because the `latest` 20.3.9 (2026-11-05) and 20.3.10 (2026-11-16) are younger than 14 days. Exact pins only.
- One upgrade per `build/` branch: Task 1 on `build/mssql`; Tasks 2-3 on `feat/private-data-api-layers`. Merge commits, owner pushes.
- No UAT names in any core file or commit.

## Tasks

### Task 1: add `mssql` (`build/mssql`)

- [ ] Check `@types/mssql` on the registry (version, date, peer deps); if `mssql` 12 ships its own types, skip it.
- [ ] `npm install --save-exact mssql@12.7.14` (+ types if needed); add `"overrides": { "tedious": "20.3.8" }`; `npm ls tedious` shows 20.3.8 only.
- [ ] Decision row D23 in `docs/ARCHITECTURE.md`: context (a private AUT keeps one-time codes and generated passwords only in SQL Server), decision (`mssql` exact pin, `tedious` override and why), enforcer (`npm ls tedious`, review).
- [ ] Verify: typecheck, lint, `test:unit`, `verify:lint`, guard. Commit `build: add mssql for private SQL Server reads`.

### Task 2: `private/src/data` and `private/src/api` layers (`feat/private-data-api-layers`)

- [ ] Failing `verify:lint` cases first in `scripts/verify-lint-rules.mjs`: `private data must not import pages` (`private/src/data/x.ts` importing `@uat/src/pages`), `private api must not import pages` (`private/src/api/x.ts`), `private pages may import private data`, `private api must not import @playwright/test values` (type imports allowed). Run `npm run verify:lint`: the new cases fail.
- [ ] `eslint.config.ts`: `UatLayer` gains `data` and `api`; `restrict` blocks for `private/src/data/**` (no components, api, pages, fixtures; Playwright banned) and `private/src/api/**` (no components, pages, fixtures; Playwright types only); `private/src/components`, `pages`, `fixtures` may import `data`; pages/fixtures may import `api`. `verify:lint` passes.
- [ ] D24 row: the private layering mirrors the core one; enforcer `verify:lint`.
- [ ] Commit `feat(lint): add the data and api layers to private`.

### Task 3: guard the new secret

- [ ] Failing case in `tests/unit/scripts/private-guard.spec.ts`: an unpushed commit that adds the value of a `.env` key ending in `_PASSWORD` other than `AUTH_PASSWORD` is rejected (value never printed, skipped below 6 chars).
- [ ] `scripts/private-guard.mjs`: check every `*_PASSWORD` value of `private/.env`, not only `AUTH_PASSWORD`. Update the D22 row.
- [ ] Verify all gates. Commit `fix(scripts): guard every password key of the private env`.

### Verification (end)

`npm run typecheck`, `npm run lint`, `npm run verify:lint`, `npm run test:unit`, `npm run guard` all pass; `npm ls tedious` = 20.3.8.
