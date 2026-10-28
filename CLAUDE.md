# Project guide for Claude Code

Greenfield Playwright Test + TypeScript (strict) framework, web UI + API. Not a Katalon migration.

## Source of truth
- Spec: `docs/superpowers/specs/2026-10-28-playwright-ts-framework-design.md`
- Plan: `docs/superpowers/plans/2026-10-28-playwright-ts-framework.md`
Execute the plan task by task, in order. Do not skip the failing-test step. Commit after each task. If the plan and spec conflict, stop and ask.

## Rules (apply to every change)
- Layering, no cycles: `config <- utils <- api/components <- pages <- fixtures <- tests`. Flag any change that breaks it.
- Page objects: locators, verify, input and atomic actions only. No business-flow methods. Pages compose components.
- Inject pages/components/clients via fixtures; never `new` them in tests. Tests import `test`/`expect` from `@fixtures/conduit` (exception: `tests/unit`).
- Tests call actions one by one, each wrapped in `test.step('<label>')`.
- Locator priority: getByRole > getByLabel > getByTestId > getByText > CSS. XPath last resort, reason in commit message.
- Web-first assertions only. Never `waitForTimeout` or manual sleeps. Never fix flakiness with timeouts or more retries.
- Tests isolated and parallel-safe. Prefer API for setup/teardown data.
- No hard-coded secrets or URLs; everything from env/config.
- Strict types, no `any`, ESLint-clean, compact, no code comments.
- Never invent Playwright APIs; check the docs when unsure and say so.
- Public repo must never contain company UAT details. `private/` is gitignored and is its own git repo.

## Definition of done
- `npm run typecheck`: 0 errors. `npm run lint`: 0 errors/warnings.
- From Task 10 on: `npm run test:stability` (`--repeat-each=5 --workers=4`) passes with no flakes.
- No `waitForTimeout`, no `any`, no hard-coded secrets, no layering violation.

## Environment
- Docker only on the personal laptop. Task 4 and the Conduit suites need it. Tasks 1-3, 5, 6 run without it.
- Node 22 LTS (`.nvmrc`). TypeScript pinned to 6.0.3 on purpose (typescript-eslint peer range).

## Bug fixes
Root cause first (locator strictness, actionability, race, isolation, shared worker state, data, env, typing). Report: root cause -> fix -> how to verify -> regression risk.

## Working style
Short, direct output. Code and decisions first.
