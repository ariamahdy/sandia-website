# Project guide for Claude Code

Greenfield Playwright Test + TypeScript (strict) framework, web UI + API. Not a Katalon migration.

## Source of truth
- Architecture and rules: `README.md` and this file. AUT facts: `infra/conduit/README.md`.
Write the failing test first. Commit after each change. If a change conflicts with these, stop and ask.

## Scope
- Out of scope (YAGNI): Katalon mapping, multi-browser, visual regression, custom reporters, logging wrappers, retry/wait utilities, self-hosted UAT CI runner.
- Playwright built-ins first (reporters, trace, `test.step`, `expect.poll`/`toPass`, `expect.soft`, projects, fixtures). Custom code only when a built-in is proven insufficient, with the reason stated.

## Rules (apply to every change)
- Layering, no cycles: `config <- utils <- data <- api/components <- pages <- fixtures <- tests`. Flag any change that breaks it.
- Page objects: locators, verify, input and atomic actions only. No business-flow methods. Pages compose components.
- Inject pages/components/clients via fixtures; never `new` them in tests. Tests import `test`/`expect` from `@fixtures/conduit` (exception: `tests/unit`).
- Tests call actions one by one, each wrapped in `test.step('<label>')`. Not lint-enforced; check it in review.
- Locator priority: getByRole > getByLabel > getByTestId > getByText > CSS. XPath last resort, reason in commit message.
- Web-first assertions only. Never `waitForTimeout` or manual sleeps. Never fix flakiness with timeouts or more retries.
- Tests isolated and parallel-safe. Prefer API for setup/teardown data.
- No hard-coded secrets or URLs; everything from env/config.
- Strict types, no `any`, ESLint-clean, compact, no code comments.
- Never invent Playwright APIs; check the docs when unsure and say so.
- Public repo must never contain company UAT details. `private/` is gitignored and is its own git repo.
- Core changes found while working on UAT go into this repo, never into `private/` (not toolable, manual discipline).

## Conventions
- Test titles start with an ID: `API-<AREA>-NNN` or `E2E-<AREA>-NNN` (e.g. `API-AUTH-001`, `E2E-ART-002`).
- Assertion methods on pages/components are named `verify*`; lint `expect-expect` recognises only that prefix.
- API client paths have no leading slash (`articles/${slug}`); `createApiContext` adds a trailing slash to the base URL so `/api` is kept.
- Changing a lint rule means updating `scripts/verify-lint-rules.mjs` with a case that proves it fires.

## Definition of done
- `npm run typecheck`: 0 errors. `npm run lint`: 0 errors/warnings. `npm run verify:lint` and `npm run guard` pass.
- `npm run test:unit` passes. With the AUT up: `npm run test:stability` (`--repeat-each=5 --workers=4`) passes with no flakes.
- No `waitForTimeout`, no `any`, no hard-coded secrets, no layering violation.

## Environment
- Docker only on the personal laptop. The Conduit API/E2E suites and `test:stability` need it; typecheck, lint and unit tests run without it.
- Company laptop: no Docker, runs only `AUT=uat`. UAT values belong in `private/.env` (`AUTH_USERNAME`, `AUTH_PASSWORD`). Run with `npm run test:uat` (cross-platform; never `AUT=uat npx ...`, which fails in PowerShell/cmd).
- Node 26 LTS (`.nvmrc`). TypeScript pinned to 6.0.3 on purpose (typescript-eslint peer range).

## Bug fixes
Root cause first (locator strictness, actionability, race, isolation, shared worker state, data, env, typing). Report: root cause -> fix -> how to verify -> regression risk.

## Working style
Short, direct output. Code and decisions first.
