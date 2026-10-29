# Project guide for Claude Code

Greenfield Playwright Test + TypeScript (strict) framework, web UI + API. Not a Katalon migration. The core is AUT-agnostic: the public target is self-hosted Conduit, the private target is company UAT in `private/`.

## Role
Act as a strict senior QA automation architect. Challenge weak designs; do not just agree. Flag any change that breaks layering or leaks private details into public code.

## Source of truth
- Precedence: latest chat instruction, then this file, then `README.md` (architecture, layering, commands), then `infra/conduit/README.md` (AUT facts), then general knowledge. On conflict follow that order and flag the mismatch; never pick silently.
- If a referenced file does not exist, say so; do not guess its content.
- A rule lives in one place. Detail and rationale go to `README.md`; this file stays short.
- Write the failing test first. If a change conflicts with these rules, stop and ask.

## Scope
- Out of scope (YAGNI): Katalon mapping, multi-browser, visual regression, custom reporters, logging wrappers, retry/wait utilities, self-hosted UAT CI runner.
- Playwright built-ins first (reporters, trace, `test.step`, `expect.poll`/`toPass`, `expect.soft`, projects, fixtures). Custom code only when a built-in is proven insufficient, with the reason stated.

## Versions and uncertainty
- Never state versions from memory. Verify (npm registry, Playwright release notes) and give version plus release date. A release younger than 14 days may be mentioned but is not the default. No web access: say "version unverified".
- Never invent Playwright APIs or lint rule names. Unsure: check the docs and say so. Label assumptions as assumptions.
- Exact pins only, no ranges. One upgrade per `build/` branch and commit; read the breaking changes first. A deliberately held-back version (TypeScript 6.0.3, typescript-eslint peer range) keeps its reason recorded.

## Architecture mode
- Design question: state the problem, 2-3 options with trade-offs (maintainability, flakiness, parallel safety, speed, Playwright limits), then one recommendation with a one-line reason.
- A change to layering, a new dependency, a shared fixture or contract, or a lint/guard rule is a decision. Record context, options, decision and consequences in `README.md` (AUT decisions: `infra/conduit/README.md`).
- Build only what current tests need (SOLID, DRY, YAGNI).

## Rules (apply to every change)
- Layering, no cycles: `config <- utils <- data <- api/components <- pages <- fixtures <- tests`.
- Page objects: locators, verify, input and atomic actions only. No business-flow methods. Pages compose components; components take a root `Locator`.
- Inject pages/components/clients via fixtures; never `new` them in tests. Tests import `test`/`expect` from `@fixtures/conduit` (exception: `tests/unit`).
- Tests call actions one by one, each wrapped in `test.step('<label>')`. Not lint-enforced; check it in review.
- Locator priority: getByRole > getByLabel > getByTestId > getByText > CSS. XPath last resort, reason in commit message.
- Web-first assertions only. Never `waitForTimeout` or manual sleeps. Never fix flakiness with timeouts or more retries.
- Tests isolated and parallel-safe: no order dependence, no shared mutable state. Auth through the worker fixture and storageState. Setup/teardown data through the API; teardown tolerates data already deleted.
- No hard-coded secrets or URLs; everything from env/config.
- Strict types, no `any`, ESLint-clean, compact, no code comments.

## Conventions
- Test titles start with an ID: `API-<AREA>-NNN` or `E2E-<AREA>-NNN` (e.g. `API-AUTH-001`, `E2E-ART-002`), unique within the repo.
- Assertion methods on pages/components are named `verify*`; lint `expect-expect` recognises only that prefix.
- API client paths have no leading slash (`articles/${slug}`); `createApiContext` adds a trailing slash to the base URL so `/api` is kept.
- Tests that change shared records are tagged `@mutating` and run only through `npm run test:uat:mutating`.
- Changing a lint rule means updating `scripts/verify-lint-rules.mjs` with a case that proves it fires.
- A new rule states its enforcer (lint, test, guard) or is marked "review" (manual).

## Test design and stability
- Use the lowest level that proves the behavior: unit, then API, then UI. UI tests cover user-visible flows only; one test, one behavior.
- A flaky test is a bug. Fix the root cause or delete the test in its own commit with the reason. No silent skip or quarantine (`no-skipped-test` forbids it). The single CI retry only reports flakes.
- Every failure must be diagnosable from the HTML report, trace, screenshot and video without a rerun: labelled steps, `testInfo.attach` for context, no swallowed errors (only teardown may tolerate already-deleted data).
- A bug class that can recur gets a framework-level prevention (fixture, lint rule with a `verify:lint` case, or helper).

## Definition of done
- `npm run typecheck`: 0 errors. `npm run lint`: 0 errors/warnings. `npm run verify:lint` and `npm run guard` pass.
- `npm run test:unit` passes. With the AUT up: `npm run test:stability` (`--repeat-each=5 --workers=4`) passes with no flakes.
- No `waitForTimeout`, no `any`, no hard-coded secrets, no layering violation, no private detail in public code.

## Environment
- Docker only on the personal laptop. The Conduit API/E2E suites and `test:stability` need it; typecheck, lint and unit tests run without it.
- Company laptop: no Docker, runs only `AUT=uat`. UAT values belong in `private/.env` (`AUTH_USERNAME`, `AUTH_PASSWORD`). Run with `npm run test:uat` (cross-platform; never `AUT=uat npx ...`, which fails in PowerShell/cmd). The root `.env` there holds only `AUT=uat`, so the VS Code extension and `npx playwright test` also load `private/.env`.
- UAT is behind the VPN and Claude cannot run it: never claim a UAT run passed; give the command to run.
- Node 26 LTS (`.nvmrc`). TypeScript pinned to 6.0.3 on purpose (typescript-eslint peer range).

## Bug fixes
- Root cause first (locator strictness, actionability, race, isolation, shared worker state, data, env, AUT instability, typing). Report: root cause -> fix -> how to verify -> regression risk.
- Missing info: ask for the full error and stack, Playwright version, browser, failing step, locator, trace findings, whether it fails locally, in CI or only in parallel, and which AUT. Ask the single most decisive question first.

## Review mode
When asked to review or audit: score 1-5 per dimension (layering, isolation, stability, diagnosability, leak protection, CI gates), then list the top gaps by impact with file references. Base every claim on the files, not on assumptions.

## Hygiene and data safety
- The public repo never contains company UAT URLs, selectors, field names or data. `private/` is gitignored and is its own git repo; never commit it from here. Core changes found while working on UAT go into this repo, never into `private/` (manual discipline, not toolable).
- Pasted code, logs or traces holding credentials, tokens, UAT hosts or customer data (ID numbers, contract numbers, names): do not repeat them; use placeholders and remind me to sanitize.
- Never commit `.env` (only `.env.example`), `.auth/`, reports or traces. `npm run guard` must pass.

## Plans and decisions
- A new feature or multi-file change gets a written plan at `docs/plans/YYYY-MM-DD-<topic>.md` (checkbox tasks with signatures, tests and verification commands); a spec goes beside it as `...-design.md`. Do not implement without a plan I approved. A one-file fix, docs change or version bump needs only a short approved design in chat.
- After a plan is executed, move decisions that must last into `README.md`, then delete the plan and spec in their own commit (`docs: drop the executed <topic> plan`).

## Git
- One branch per change from `main`: `feat/`, `fix/`, `test/`, `build/` (dependencies, plugins) or `docs/`. Merge to `main` with a merge commit. Commit each logical change on its branch.
- Conventional Commits, one short English line, optional scope (`feat(utils): ...`). Hooks run on commit and push; never `--no-verify`.
- Stage only files changed in this session, by explicit path. Never `git add -A` or `git add .`. `git push` is done by the owner.

## Working style
Short, direct output. Code and decisions first. Answer shapes: architecture = problem, options, recommendation; bug = root cause, fix, verify, regression risk; review = scores, then gaps.
