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
- `npm run guard` (pre-push and CI) fails if `private/` or an env file other than `.env.example` is tracked, or if tracked text matches `scripts/guard.denylist.txt` merged with `private/guard.denylist.txt`. It also scans the added lines of every commit not on a remote yet, so a term added and removed again before a push still fails it.
- CI runs on a clean clone without `private/`, plus gitleaks.
- `npm install` (`prepare`) points the `private` repo's `core.hooksPath` at `scripts/private-hooks`, whose pre-commit runs `npm run typecheck`, ESLint on all of `private/` and `npm run test:uat:unit`; without `private/`, or outside a git checkout, it is skipped.


## Porting a page from an older suite

A Katalon or Selenium script is a list of intended actions, not a description of the page: it can miss clicks, and its locators reflect another tool's view of the DOM. Port from the real page.

1. Read the old script and list every action, including each confirmation and each submit inside a dialog or panel. A form that is filled but never submitted is a missing step, not a quirk to copy.
2. Take locators from the real page: `npx playwright codegen <url>` on a machine that reaches the AUT, or the page snapshot in `error-context.md` from a first run. Never copy an old XPath or CSS selector without checking it against that snapshot.
3. Before writing the page object, answer for each element:
   - Is it a link or a button? An action shown as a link is still the user's "button".
   - Does a button show only an icon? Its accessible name is the icon, so locate it by `title`.
   - Is a popup a library alert (often reused in place and faded out rather than removed), a modal dialog, or a section of the page without `role="dialog"`?
   - Does a confirmation open a second, result popup, and what does it say?
   - Is a date or month field a native `type="date"`/`type="month"` input? `fill()` then needs the ISO value.
4. A first run that fails is read from its snapshot and trace, not by re-reading the old script.

## Decisions

A change to layering, a new dependency, a shared fixture or contract, or a lint/guard rule adds a row here with context, decision and enforcer. "Review" means no tool enforces it.

| # | Decision | Context | Enforcer |
|---|---|---|---|
| D1 | Playwright built-ins first; no custom reporters, retry or wait utilities, logging wrappers | YAGNI; custom code only when a built-in is proven insufficient, with the reason stated | Review |
| D2 | Exact version pins; TypeScript held at 6.0.3 | `.npmrc` sets `save-exact`; TypeScript stays at 6.0.3 because of the typescript-eslint peer range | `.npmrc`, `package.json` |
| D3 | Window size: `--window-size=1920,1080` with `viewport: null` in `src/config/projects.ts` for headless; CDP `Browser.setWindowBounds` in the `page` fixture of `src/fixtures/base.ts` for headed | Headless ignores `--start-maximized` and falls back to 800x600. On Windows `--window-size` wins over `--start-maximized`, so headed runs opened large but not maximized. The config cannot see `--headed`, and overriding `launchOptions` on headless forms a fixture cycle. Source: commits `46757d8`, `6fca330` | `tests/unit/config/projects.spec.ts` pins the arguments; the CDP path is review only |
| D4 | One user per parallel worker, created through the API; session saved to `.auth/<aut>-<parallelIndex>.json`; teardown through the API tolerating data already deleted | Parallel safety without shared mutable state | Fixtures; `npm run test:stability` |
| D5 | API responses are validated against zod contracts (`src/api/conduit/schemas.ts`) | A contract drift fails at the client, not deep in a test | API suite; clients take a zod schema (`src/api/http-client.ts`) |
| D6 | CI retries once, only to report flakes; `forbidOnly` in CI; trace kept for every failure (`retain-on-failure`), screenshot and video on failure | Flakiness is fixed at the root, never hidden by retries. `on-first-retry` recorded no trace outside CI, where retries are 0, so local and UAT failures had none. UAT traces contain the typed password: they stay in gitignored `test-results/` and are never shared. `error-context.md` holds no password, but its page snapshot shows the page data (D19), so it is masked before it leaves the company | `playwright.config.ts` |
| D7 | Tests that change shared records carry `@mutating`; default e2e projects skip them; `npm run test:uat:mutating` runs them in a separate project with one worker; mutating tests that depend on each other run in a `test.describe` with `mode: 'serial'`, so a failed first test skips its dependant instead of failing it | Shared UAT records cannot be mutated in parallel | `src/config/projects.ts`, `tests/unit/config/projects.spec.ts`; the serial-group rule is Review |
| D8 | UAT runs through `node --env-file=private/.env`; a root `.env` holding only `AUT=uat` makes other entry points load `private/.env` | `AUT=uat npx ...` fails in PowerShell and cmd | `package.json` scripts |
| D9 | Conduit is built from pinned upstream sources, not a prebuilt image | No prebuilt RealWorld image was multi-arch | `infra/conduit/README.md` decision record |
| D10 | Public repo never holds UAT details; `private/` is its own git repo, reached one way (`private -> core`) | Hybrid goal: public showcase plus company UAT | ESLint, `npm run guard`, gitleaks in CI |
| D11 | `private/` is linted with the core rules: the Playwright test rules for `private/tests`, the layer map for `private/src/<layer>` through `@uat/src/<layer>` | The UAT suite had no Playwright rules and no layering, so `waitForTimeout`, a skipped test or a page importing fixtures passed lint there | `eslint.config.ts`, `npm run verify:lint` (3 private cases, also run without `private/`) |
| D12 | The `private` repo's commits run the core typecheck, lint and `test:uat:unit` through `scripts/private-hooks/pre-commit`, set by `scripts/setup-private-hooks.mjs` in `prepare` | `simple-git-hooks` installs hooks only in the core repo, so `private/` commits ran no checks | `scripts/private-hooks/pre-commit` |
| D13 | An opening shared by two or more tests in a file, of four or more steps, goes in `test.beforeEach` inside `test.describe`, one `test.step` per action; shorter openings stay in the tests; deeper shared prefixes get a nested `describe`. No navigation fixtures or step helpers. A test whose whole body would be the shared opening stays standalone | Copied openings meant one locator or flow change had to be edited in every test. Fixtures and helpers were rejected because they move UI flows out of the test layer | Review |
| D14 | A private AUT that keeps its session in `sessionStorage` reuses it once per worker and app through `captureSessionStorage`/`restoreSessionStorage` (`src/fixtures/session-storage.ts`), in memory only. A restore writes once per tab; when the AUT rejects it, `clearRestoredSessionStorage` empties the tab so the UI sign-in that follows cannot pick up the stale session | `storageState` covers cookies, localStorage and IndexedDB, not `sessionStorage`; the Playwright docs restore it with `addInitScript` | `tests/unit/fixtures/session-storage.spec.ts` |
| D15 | `npm run guard` scans the added lines of every local commit not on a remote yet (`git rev-list HEAD --branches --not --remotes`, so a side branch pushed from another checkout is covered) against the same denylist, with fixed diff prefixes and unquoted paths so the user's git config cannot hide a hit; it prints commit, file and pattern but never the line | The tracked-file scan missed company terms in an unpushed commit whose file had since been reworded; pushing would have published them | `tests/unit/scripts/guard.spec.ts` |
| D16 | Every workflow `uses:` is pinned to a full commit SHA with the version as a trailing comment (`<action>@<sha> # <tag>`); local and `docker://` actions are exempt. The comment is the one exception to "no code comments" | A tag can be moved by the action's owner; the comment keeps the version readable and Dependabot updates it | `scripts/guard.mjs`, `tests/unit/scripts/guard.spec.ts` |
| D17 | Dependabot proposes one PR per npm dependency or workflow action, weekly, keeping exact pins (`versioning-strategy: increase`); TypeScript is ignored (D2) permanently, so a TypeScript upgrade is a manual review when typescript-eslint widens its peer range; at most 5 open Dependabot PRs at a time (GitHub's default) | Exact pins aged silently without an update signal (former R4) | `.github/dependabot.yml` |
| D18 | A response the AUT is known to deliver slowly may get a longer timeout on the one web-first assertion that waits for that result, with the reason in the commit; never a global timeout, a fixed sleep or an extra retry | The rule "never fix flakiness with timeouts" targets hiding races; a server that is slow every time is not a race, and the assertion still fails fast on a real error | Review |
| D19 | `npm run mask:snapshot -- <file>` rewrites the page snapshot of a Playwright error file in place: the names of cells, rows, grid cells, options and list items and the values of textboxes, cells and comboboxes become `<masked>`; labels, `text:` and `generic` lines, buttons, links, headers, the error message and the test source stay. Values shown in `text:` or `generic` lines (a selected option next to its label) and in the error message are not masked | The snapshot of a private AUT shows customer data (names, ID and phone numbers), and the error file is what gets shared for diagnosis; dropping the snapshot would lose the structure and validation messages a fix needs | `tests/unit/scripts/mask-snapshot.spec.ts` |
| D20 | `private/` gets a `uat-unit` project (`private/tests/unit`, `npm run test:uat:unit`), registered only when `private/` exists and linted like `tests/unit`, so private components keep permanent tests | Private components were checked only by throwaway probes in `tests/unit`, which core CI without `private/` cannot run, so a refactor of shared private code had no regression net | `tests/unit/config/projects.spec.ts`, `npm run verify:lint`, private pre-commit |
| D21 | A private test that passes only on the AUT's current data (it expects an empty result, or filters a fixed earlier period) carries the tag `@data-dependent`; when the data changes the test is restored to its intended check, not retagged. `npm run test:uat -- --list -g @data-dependent` lists them | A test bent to today's data hides nothing today but goes stale silently, and the list of such tests must live in the repo, not in someone's memory | Review; listed by the tag |

## Risks and limits

- R1: one browser (Chromium) by decision; cross-browser defects are not detected.
- R2: the public suite is small and runs against a demo app. It proves the architecture, not scale.
- R3: `playwright.config.ts` configures no sharding, so wall time grows with the suite per worker pool.
- R5: the CDP maximize path (D3) is Chromium-only and not unit-tested.
- R6: UAT cannot run in CI because it sits behind the VPN; a self-hosted runner is out of scope.
- R7: some rules rely on discipline, not tools: `test.step` wrapping of every action, core changes found on UAT going to this repo first, and the porting checklist above.
- R8: the `private` pre-commit checks the working tree, not the staged index: a partially staged file is checked as it is on disk, and broken uncommitted core code also blocks a `private/` commit.
- R9: mutating tests of a private AUT leave their records behind, because there is no API to remove them; each such record carries a fixed prefix in its data so it can be found and removed by hand.
