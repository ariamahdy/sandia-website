# Playwright + TypeScript test framework

[![CI](https://github.com/ariamahdy/sandia-website/actions/workflows/ci.yml/badge.svg)](https://github.com/ariamahdy/sandia-website/actions/workflows/ci.yml)

A layered Playwright Test framework for web UI and API testing, written in strict TypeScript. Its core is application-agnostic and is proven against a self-hosted [RealWorld "Conduit"](https://github.com/gothinkster/realworld) app running in Docker.

- Typed, layered architecture with import rules enforced by ESLint.
- Page objects and components with atomic actions; tests read as a list of `test.step`s.
- API clients that validate every response against a zod contract.
- One user per parallel worker, created through the API and torn down through the API.
- Leak guard and git hooks for a public repo that sits next to private test code.

## Requirements

- Node 26 LTS (`.nvmrc`)
- Docker with Compose (only for the Conduit suites)

## Quick start

```bash
nvm use
npm ci
cp .env.example .env
npm run aut:up
npm test
npm run aut:down
```

The first `aut:up` builds the Conduit images from pinned upstream sources, which takes a few minutes. Later runs use the build cache. See [`infra/conduit/README.md`](infra/conduit/README.md) for the decision record.

After a run, `npx playwright show-report` opens the HTML report with steps, traces, screenshots and videos of failures.

## Configuration

Settings come from `.env` (copied from `.env.example`) and are validated with zod before Playwright starts; every missing or invalid variable is reported at once.

| Variable | Used by | Meaning |
|---|---|---|
| `AUT` | framework | `conduit` or `uat`; selects the Playwright projects |
| `BASE_URL` | framework | UI base URL |
| `API_URL` | framework | REST API base URL |
| `AUTH_USERNAME`, `AUTH_PASSWORD` | framework, `AUT=uat` only | required when `AUT=uat` |
| `CONDUIT_PORT` | Docker Compose | host port of the Conduit UI and API |
| `CONDUIT_DB_PASSWORD`, `CONDUIT_JWT_SECRET` | Docker Compose | local-only, non-secret values for the throwaway AUT |

## Project layout

```
src/
  config/        env validation, Playwright project wiring
  utils/         small pure helpers
  data/          unique test data factories
  api/           HTTP client and Conduit API clients
  components/    Navbar, ArticleList, ErrorList
  pages/         Conduit page objects
  fixtures/      base.ts (AUT-agnostic), conduit.ts
tests/
  unit/          core logic, no browser or AUT
  api/conduit/   API suite
  e2e/conduit/   UI suite
infra/conduit/   Conduit AUT: compose.yml, nginx.conf, decision record
scripts/         guard, aut-wait, lint-rule check
```

Test titles start with an ID, `API-<AREA>-NNN` or `E2E-<AREA>-NNN`, for example `E2E-ART-001 create article via UI then see it on its page`.

## Commands

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint, zero warnings allowed |
| `npm run verify:lint` | Proves the layering and test rules still fire |
| `npm run test:unit` | Pure core logic, no browser or AUT |
| `npm run test:api` | Conduit API suite |
| `npm run test:e2e` | Conduit UI suite (Chromium) |
| `npm run test:stability` | API + UI suites, `--repeat-each=5 --workers=4` |
| `npm run aut:up` / `aut:down` | Start / stop the Conduit AUT |
| `npm run guard` | Leak guard (also runs on `git push`) |

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

`private/` is gitignored and is its own git repository, cloned into place for testing a private application. It mirrors the `src/` and `tests/` layout, imports the core one way only (`private -> core`), and is reached through the `@uat/*` alias. Playwright registers its projects only when `private/` exists and `AUT=uat`. Its settings belong in `private/.env`; Playwright loads that file instead of `.env` when the shell sets `AUT=uat` (`AUT=uat npx playwright test --project=uat-e2e`).

Leak protection:

- ESLint forbids core code from importing `@uat/*` or `private/`.
- `npm run guard` (pre-push and CI) fails if `private/` or an env file other than `.env.example` is tracked, or if tracked text matches `scripts/guard.denylist.txt` merged with `private/guard.denylist.txt`.
- CI runs on a clean clone without `private/`, plus gitleaks.

## Definition of done

- `npm run typecheck`: 0 errors. `npm run lint`: 0 errors and 0 warnings.
- `npm run verify:lint`, `npm run guard` and `npm run test:unit` pass.
- With the AUT up, `npm run test:stability` passes with no flaky tests.
- No `waitForTimeout`, no `any`, no hard-coded secrets or URLs, no layering violation.

## CI

- `ci.yml`: `quality` (typecheck, lint, lint-rule check, guard, gitleaks), then `test` (Conduit up, unit, API and UI suites; HTML report and traces uploaded as artifacts).
- `stability.yml`: weekly and on demand, runs `npm run test:stability`.

## License

[MIT](LICENSE)
