# Architecture

Source of truth for the layering, isolation model, private extension point, decisions and known limits of this framework. Setup, configuration and commands are in [`README.md`](../README.md); working rules for Claude Code are in [`CLAUDE.md`](../CLAUDE.md); AUT facts are in [`infra/conduit/README.md`](../infra/conduit/README.md). A rule is written in one place only.

## Layering

```
config  <-  utils  <-  data  <-  api / components  <-  pages  <-  fixtures  <-  tests
```

Each layer may import only from layers to its left. `eslint.config.ts` enforces this per directory, and `npm run verify:lint` checks that the rules keep firing. The same map, and the Playwright test rules, apply to `private/src/<layer>` and `private/tests`, through the `@uat/src/<layer>` aliases.

| Layer | Contains | Not allowed |
|---|---|---|
| `src/config` | env loading and validation (zod), Playwright project wiring | anything above it |
| `src/utils` | small pure helpers | anything above it |
| `src/data` | factories that build unique test data | anything above it |
| `src/api` | thin `APIRequestContext` clients, zod-validated responses | UI, assertions on behaviour |
| `src/components` | scoped by a root `Locator`: locators, `verify*`, atomic actions | page knowledge |
| `src/pages` | compose components; locators, `verify*`, atomic actions | business flows (e.g. `login(user, pass)`) |
| `src/fixtures` | inject pages, components, clients and data; API teardown | business assertions |
| `tests` | call actions one by one, each inside `test.step` | `new` page objects, raw locators, importing `@playwright/test` |

Only `src/fixtures` and `tests/unit` import `@playwright/test` freely. Other core layers import types only, and components/pages may also import `expect` for web-first `verify*` methods.

Locator priority: `getByRole` > `getByLabel` > `getByTestId` > `getByText` > CSS. XPath is a last resort. Any CSS or XPath locator carries its reason in the commit message.


## Test isolation

- A worker fixture registers a unique user through the API, signs in once through the UI and saves `.auth/<aut>-<parallelIndex>.json`. The browser, the API clients and teardown all act as that user.
- Every test creates its own data through the API with unique values and removes it in fixture teardown, tolerating data the test already deleted.
- No order dependence, no shared mutable state, no `waitForTimeout`. Flakiness is fixed at the root, never with timeouts or retries. CI retries once only to report flakes.


## Private extension point

`private/` is gitignored and is its own git repository, cloned into place for testing a private application. It mirrors the `src/` and `tests/` layout, imports the core one way only (`private -> core`), and is reached through the `@uat/*` alias. Playwright registers its projects only when `private/` exists and `AUT=uat`. Its settings belong in `private/.env`; `npm run test:uat` loads it with `node --env-file`, which works the same on Windows and macOS; append Playwright options after `--` (`npm run test:uat -- --repeat-each=5`). Tests that change shared records are tagged `@mutating`: every e2e project skips them, and only `npm run test:uat:mutating` runs them, in its own `uat-mutating` project with one worker. A root `.env` containing only `AUT=uat` makes every other entry point (`npx playwright test`, the VS Code extension) load `private/.env` too; `AUT` from the shell wins over that file.

Leak protection:

- ESLint forbids core code from importing `@uat/*` or `private/`.
- `npm run guard` (pre-push and CI) fails if `private/` or an env file other than `.env.example` is tracked, or if tracked text matches `scripts/guard.denylist.txt` merged with `private/guard.denylist.txt`.
- CI runs on a clean clone without `private/`, plus gitleaks.
- `npm install` (`prepare`) points the `private` repo's `core.hooksPath` at `scripts/private-hooks`, whose pre-commit runs `npm run typecheck` and ESLint on all of `private/`; without `private/`, or outside a git checkout, it is skipped.


## Decisions

A change to layering, a new dependency, a shared fixture or contract, or a lint/guard rule adds a row here with context, decision and enforcer. "Review" means no tool enforces it.

| # | Decision | Context | Enforcer |
|---|---|---|---|
| D1 | Playwright built-ins first; no custom reporters, retry or wait utilities, logging wrappers | YAGNI; custom code only when a built-in is proven insufficient, with the reason stated | Review |
| D2 | Exact version pins; TypeScript held at 6.0.3 | `.npmrc` sets `save-exact`; TypeScript stays at 6.0.3 because of the typescript-eslint peer range | `.npmrc`, `package.json` |
| D3 | Window size: `--window-size=1920,1080` with `viewport: null` in `src/config/projects.ts` for headless; CDP `Browser.setWindowBounds` in the `page` fixture of `src/fixtures/base.ts` for headed | Headless ignores `--start-maximized` and falls back to 800x600. On Windows `--window-size` wins over `--start-maximized`, so headed runs opened large but not maximized. The config cannot see `--headed`, and overriding `launchOptions` on headless forms a fixture cycle. Source: commits `46757d8`, `6fca330` | `tests/unit/config/projects.spec.ts` pins the arguments; the CDP path is review only |
| D4 | One user per parallel worker, created through the API; session saved to `.auth/<aut>-<parallelIndex>.json`; teardown through the API tolerating data already deleted | Parallel safety without shared mutable state | Fixtures; `npm run test:stability` |
| D5 | API responses are validated against zod contracts (`src/api/conduit/schemas.ts`) | A contract drift fails at the client, not deep in a test | API suite; clients take a zod schema (`src/api/http-client.ts`) |
| D6 | CI retries once, only to report flakes; `forbidOnly` in CI; trace kept for every failure (`retain-on-failure`), screenshot and video on failure | Flakiness is fixed at the root, never hidden by retries. `on-first-retry` recorded no trace outside CI, where retries are 0, so local and UAT failures had none. UAT traces contain the typed password: they stay in gitignored `test-results/` and are never shared; `error-context.md` is safe to share | `playwright.config.ts` |
| D7 | Tests that change shared records carry `@mutating`; default e2e projects skip them; `npm run test:uat:mutating` runs them in a separate project with one worker | Shared UAT records cannot be mutated in parallel | `src/config/projects.ts`, `tests/unit/config/projects.spec.ts` |
| D8 | UAT runs through `node --env-file=private/.env`; a root `.env` holding only `AUT=uat` makes other entry points load `private/.env` | `AUT=uat npx ...` fails in PowerShell and cmd | `package.json` scripts |
| D9 | Conduit is built from pinned upstream sources, not a prebuilt image | No prebuilt RealWorld image was multi-arch | `infra/conduit/README.md` decision record |
| D10 | Public repo never holds UAT details; `private/` is its own git repo, reached one way (`private -> core`) | Hybrid goal: public showcase plus company UAT | ESLint, `npm run guard`, gitleaks in CI |
| D11 | `private/` is linted with the core rules: the Playwright test rules for `private/tests`, the layer map for `private/src/<layer>` through `@uat/src/<layer>` | The UAT suite had no Playwright rules and no layering, so `waitForTimeout`, a skipped test or a page importing fixtures passed lint there | `eslint.config.ts`, `npm run verify:lint` (3 private cases, also run without `private/`) |
| D12 | The `private` repo's commits run the core typecheck and lint through `scripts/private-hooks/pre-commit`, set by `scripts/setup-private-hooks.mjs` in `prepare` | `simple-git-hooks` installs hooks only in the core repo, so `private/` commits ran no checks | `scripts/private-hooks/pre-commit` |

## Risks and limits

- R1: one browser (Chromium) by decision; cross-browser defects are not detected.
- R2: the public suite is small and runs against a demo app. It proves the architecture, not scale.
- R3: `playwright.config.ts` configures no sharding, so wall time grows with the suite per worker pool.
- R4: no automated dependency or advisory updates (no Dependabot or Renovate); exact pins age silently.
- R5: the CDP maximize path (D3) is Chromium-only and not unit-tested.
- R6: UAT cannot run in CI because it sits behind the VPN; a self-hosted runner is out of scope.
- R7: some rules rely on discipline, not tools: `test.step` wrapping of every action, and core changes found on UAT going to this repo first.
- R8: the `private` pre-commit checks the working tree, not the staged index: a partially staged file is checked as it is on disk, and broken uncommitted core code also blocks a `private/` commit.
