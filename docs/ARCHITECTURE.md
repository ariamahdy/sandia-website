# Architecture

Source of truth for the layering, isolation model, private extension point, decisions and known limits of this framework. Setup, configuration and commands are in [`README.md`](../README.md); working rules for Claude Code are in [`CLAUDE.md`](../CLAUDE.md); AUT facts are in [`infra/conduit/README.md`](../infra/conduit/README.md). A rule is written in one place only.

## Layering

```
config  <-  utils  <-  data  <-  api / components  <-  pages  <-  fixtures  <-  tests
```

Each layer may import only from layers to its left. `eslint.config.ts` enforces this per directory, and `npm run verify:lint` checks that the rules keep firing.

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


## Decisions

A change to layering, a new dependency, a shared fixture or contract, or a lint/guard rule adds a row here with context, decision and enforcer. "Review" means no tool enforces it.

| # | Decision | Context | Enforcer |
|---|---|---|---|
| D1 | Playwright built-ins first; no custom reporters, retry or wait utilities, logging wrappers | YAGNI; custom code only when a built-in is proven insufficient, with the reason stated | Review |
| D2 | Exact version pins; TypeScript held at 6.0.3 | `.npmrc` sets `save-exact`; TypeScript stays at 6.0.3 because of the typescript-eslint peer range | `.npmrc`, `package.json` |
| D3 | Window size: `--window-size=1920,1080` with `viewport: null` in `src/config/projects.ts` for headless; CDP `Browser.setWindowBounds` in the `page` fixture of `src/fixtures/base.ts` for headed | Headless ignores `--start-maximized` and falls back to 800x600. On Windows `--window-size` wins over `--start-maximized`, so headed runs opened large but not maximized. The config cannot see `--headed`, and overriding `launchOptions` on headless forms a fixture cycle. Source: commits `46757d8`, `6fca330` | `tests/unit/config/projects.spec.ts` pins the arguments; the CDP path is review only |
| D4 | One user per parallel worker, created through the API; session saved to `.auth/<aut>-<parallelIndex>.json`; teardown through the API tolerating data already deleted | Parallel safety without shared mutable state | Fixtures; `npm run test:stability` |
| D5 | API responses are validated against zod contracts (`src/api/conduit/schemas.ts`) | A contract drift fails at the client, not deep in a test | API suite; clients take a zod schema (`src/api/http-client.ts`) |
| D6 | CI retries once, only to report flakes; `forbidOnly` in CI; trace on first retry, screenshot and video on failure | Flakiness is fixed at the root, never hidden by retries | `playwright.config.ts` |
| D7 | Tests that change shared records carry `@mutating`; default e2e projects skip them; `npm run test:uat:mutating` runs them in a separate project with one worker | Shared UAT records cannot be mutated in parallel | `src/config/projects.ts`, `tests/unit/config/projects.spec.ts` |
| D8 | UAT runs through `node --env-file=private/.env`; a root `.env` holding only `AUT=uat` makes other entry points load `private/.env` | `AUT=uat npx ...` fails in PowerShell and cmd | `package.json` scripts |
| D9 | Conduit is built from pinned upstream sources, not a prebuilt image | No prebuilt RealWorld image was multi-arch | `infra/conduit/README.md` decision record |
| D10 | Public repo never holds UAT details; `private/` is its own git repo, reached one way (`private -> core`) | Hybrid goal: public showcase plus company UAT | ESLint, `npm run guard`, gitleaks in CI |

## Risks and limits

- R1: one browser (Chromium) by decision; cross-browser defects are not detected.
- R2: the public suite is small and runs against a demo app. It proves the architecture, not scale.
- R3: `playwright.config.ts` configures no sharding, so wall time grows with the suite per worker pool.
- R4: no automated dependency or advisory updates (no Dependabot or Renovate); exact pins age silently.
- R5: the CDP maximize path (D3) is Chromium-only and not unit-tested.
- R6: UAT cannot run in CI because it sits behind the VPN; a self-hosted runner is out of scope.
- R7: some rules rely on discipline, not tools: `test.step` wrapping of every action, and core changes found on UAT going to this repo first.
