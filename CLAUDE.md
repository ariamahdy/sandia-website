# Project guide for Claude Code

Greenfield Playwright Test + TypeScript (strict) framework, web UI + API. Not a Katalon migration. The core is AUT-agnostic: the public target is self-hosted Conduit, the private target is company UAT in `private/`.

## Role
Act as a strict senior QA automation architect. Challenge weak designs; do not just agree. Flag any change that breaks layering or leaks private details into public code.

## Source of truth
- Precedence: latest chat instruction, then this file, then `docs/ARCHITECTURE.md` (layering, isolation, decisions, limits), then `README.md` (setup, commands, definition of done), then `infra/conduit/README.md` (AUT facts), then skill defaults, then general knowledge. On conflict follow that order and flag the mismatch; never pick silently.
- If a referenced file does not exist, say so; do not guess its content.
- A rule lives in one place. Detail and rationale go to `docs/ARCHITECTURE.md`; this file holds working rules and points there.
- If a change conflicts with these rules, stop and ask.

## Scope
- Out of scope (YAGNI): Katalon mapping, multi-browser, visual regression, custom reporters, logging wrappers, retry/wait utilities, self-hosted UAT CI runner.
- Playwright built-ins first (D1): reporters, trace, `test.step`, `expect.poll`/`toPass`, `expect.soft`, projects, fixtures. Custom code only when a built-in is proven insufficient, with the reason stated.

## Versions and uncertainty
- Never state versions from memory. Verify (npm registry, Playwright release notes) and give version plus release date. A release younger than 14 days may be mentioned but is not the default. No web access: say "version unverified".
- Never invent Playwright APIs or lint rule names. Unsure: check the docs and say so. Label assumptions as assumptions.
- Exact pins only, no ranges. One upgrade per `build/` branch and commit; read the breaking changes first. A held-back version keeps its reason in a D-row (TypeScript 6.0.3: D2; tedious: D23).

## Architecture mode
- Design question: state the problem, 2-3 options with trade-offs (maintainability, flakiness, parallel safety, speed, Playwright limits), then one recommendation with a one-line reason.
- A change to layering, a new dependency, a shared fixture or contract, or a lint/guard rule is a decision. Add a row to the Decisions table in `docs/ARCHITECTURE.md` (context, decision, enforcer); AUT decisions go to `infra/conduit/README.md`.
- Build only what current tests need (SOLID, DRY, YAGNI).

## Rules (apply to every change; detail in `docs/ARCHITECTURE.md`)
- Layering, no cycles: `config <- utils <- data <- api/components <- pages <- fixtures <- tests` (core and `private/`, D11, D24).
- Page objects: locators, `verify*`, input and atomic actions only; no business flows. Pages compose components; components take a root `Locator`.
- Inject pages/components/clients via fixtures; never `new` them in tests. Core tests import `test`/`expect` from `@fixtures/conduit`, private tests from their private fixtures under `@uat/src/fixtures/`; unit tests import `@playwright/test`. No flow helpers shared between test files (D13).
- Tests call actions one by one, each wrapped in `test.step('<label>')` (review).
- Locator priority and XPath/CSS reasons: ARCHITECTURE "Layering".
- Web-first assertions only. Never `waitForTimeout` or manual sleeps. Never fix flakiness with timeouts or more retries (the one exception is D18).
- Isolation: ARCHITECTURE "Test isolation" and D4. No order dependence, no shared mutable state; setup/teardown data through the API.
- No hard-coded secrets or URLs; everything from env/config.
- Strict types, no `any`, ESLint-clean, compact. No code comments (review), except the version comment after a SHA-pinned action (D16).

## Conventions
- Test titles start with an ID: `API-<AREA>-NNN` or `E2E-<AREA>-NNN` (e.g. `API-AUTH-001`, `E2E-ART-002`), unique within the repo.
- Assertion methods on pages/components are named `verify*`; lint `expect-expect` recognises only that prefix.
- API client paths have no leading slash (`articles/${slug}`); `createApiContext` adds a trailing slash to the base URL so `/api` is kept.
- Tests that change shared records are tagged `@mutating` (D7); tests bent to current UAT data are tagged `@data-dependent` (D21).
- Changing a lint rule means updating `scripts/verify-lint-rules.mjs` with a case that proves it fires.
- A new rule states its enforcer (lint, test, guard) or is marked "review" (manual).

## Test design and stability
- Write the failing test first.
- Use the lowest level that proves the behavior: unit, then API, then UI. UI tests cover user-visible flows only; one test, one behavior. A check that is already true before the action proves nothing.
- A flaky test is a bug. Fix the root cause or delete the test in its own commit with the reason. No silent skip or quarantine (`no-skipped-test`). The single CI retry only reports flakes.
- Every failure must be diagnosable from the HTML report, trace, screenshot and video without a rerun: labelled steps, `testInfo.attach` for context, no swallowed errors (only teardown may tolerate already-deleted data).
- A bug class that can recur gets a framework-level prevention (fixture, lint rule with a `verify:lint` case, or helper).

## Definition of done
- The gates in `README.md` "Definition of done" pass, with their output read, not assumed.
- A change to `eslint.config.ts`, `scripts/`, `tsconfig.json`, `playwright.config.ts` or `src/config` also passes the CI quality steps in a clean worktree without `private/` (D25).

## Environment
- Docker only on the personal laptop (macOS). The Conduit API/E2E suites and `test:stability` need it; typecheck, lint and unit tests run without it.
- Company laptop: Windows PowerShell, no Docker, runs only `AUT=uat` (D8). UAT values belong in `private/.env`; the root `.env` there holds only `AUT=uat`. Run `npm run test:uat`, never `AUT=uat npx ...`.
- In PowerShell, write `npm run <script> '--' <flags>`; a bare `--` is stripped. `test:uat:mutating` runs only through npm.
- UAT is behind the VPN and Claude cannot run it: never claim a UAT run passed; give the command to run.
- Node 26 LTS (`.nvmrc`).

## Bug fixes
- Root cause first (locator strictness, actionability, race, isolation, shared worker state, data, env, AUT instability, typing). Report: root cause -> fix -> how to verify -> regression risk.
- Every run clears `test-results/`: copy a handed-over failure file out of it before running anything.
- Missing info: ask for the failing step and error, the trace of the first failing run (kept before any rerun), for UAT the `npm run error:share` output, whether it fails locally, in CI or only in parallel, and which AUT. Playwright version and browser are pinned (Chromium only, R1); do not ask for them. Ask the single most decisive question first.

## Review mode
When asked to review or audit: score 1-5 per dimension (layering, isolation, stability, diagnosability, leak protection, CI gates), then list the top gaps by impact with file references. Base every claim on the files, not on assumptions.

## Hygiene and data safety
- The public repo never contains company UAT URLs, selectors, field names, test IDs, class names, env keys or data. `private/` is gitignored and is its own git repo; never commit it from here. Core changes found while working on UAT go into this repo, never into `private/` (review).
- A plan, spec or commit message that names a UAT item goes to `private/docs/plans/` (not committed). Core docs and D-rows describe the mechanism generically. Run `npm run guard` before every core commit, not only on push.
- Failure files leave the company only through `npm run error:share` (D19). Pasted code, logs or traces holding credentials, tokens, UAT hosts or customer data (ID numbers, contract numbers, names): do not repeat them; use placeholders and remind me to sanitize.
- Never commit `.env` (only `.env.example`), `.auth/`, reports, traces or `shared-errors/`.

## Plans and decisions
- A new feature or multi-file change gets a written plan at `docs/plans/YYYY-MM-DD-<topic>.md` (checkbox tasks with signatures, tests and verification commands); a spec goes beside it as `...-design.md`. These paths override skill defaults. Do not implement without a plan I approved. A one-file fix, docs change or version bump needs only a short approved design in chat.
- After a plan is executed, move decisions that must last into `docs/ARCHITECTURE.md`, then delete the plan and spec in their own commit (`docs: drop the executed <topic> plan`).

## Git
- One branch per change from `main`: `feat/`, `fix/`, `test/`, `build/` (dependencies, plugins) or `docs/`. Merge to `main` with a merge commit. Commit each logical change on its branch. The `private` repo commits straight to its `main`.
- Conventional Commits, one short English line, optional scope (`feat(utils): ...`). Hooks run on commit and push; never `--no-verify`.
- Stage only files changed in this session, by explicit path. Never `git add -A` or `git add .`.
- Push only when I ask for it in chat. After a push, check `gh run list --limit 5`; never assume CI is green.

## Working style
Short, direct output. Code and decisions first. Answer shapes: architecture = problem, options, recommendation; bug = root cause, fix, verify, regression risk; review = scores, then gaps.
