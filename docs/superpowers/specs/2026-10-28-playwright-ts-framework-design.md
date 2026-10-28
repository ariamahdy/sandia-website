# Playwright + TypeScript Framework Design

Date: 2026-10-28
Status: Draft for review

## 1. Purpose and scope

Greenfield Playwright Test + TypeScript (strict) framework for web UI and API testing. Not a Katalon migration; no parity tracking, no legacy test IDs.

Hybrid goal:
- Production-grade core, used privately against the company UAT (behind VPN).
- Clean public repo as a showcase, targeting a self-hosted public AUT (RealWorld/Conduit via Docker).

Success criteria:
- Core has zero knowledge of any AUT and zero dependency on Docker.
- Public repo contains nothing from company UAT (URLs, selectors, field names, data).
- A clean clone (without `private/`) passes typecheck, lint, and the Conduit suite.
- Definition of done per change: `tsc --noEmit` 0 errors, ESLint 0 errors/warnings, `--repeat-each=5 --workers=4` no flakes, no `waitForTimeout`, no `any`, no hard-coded secrets or URLs, no layering violation.

Out of scope (YAGNI): Katalon mapping, self-hosted UAT CI runner, multi-browser, visual regression, custom reporters, logging wrappers, retry/wait utilities.

Constraints:
- Docker runs only on the personal laptop, not on the company laptop. Company laptop can run only `AUT=uat`.
- Conduit image must be multi-arch (amd64 + arm64) with a small RAM footprint.

## 2. Repository model

Decision: single public repo with a git-ignored `private/` directory that is itself a separate private git repo (cloned into place). Rejected alternatives: plain gitignored adapter (unversioned, leak-prone), core as npm package (premature overhead).

```
.
  src/
    config/        env loading + validation
    utils/         pure helpers (only what is used)
    api/           http-client.ts, conduit/*.client.ts
    components/    Navbar, ArticleList, Pagination, ErrorList
    pages/conduit/ login, register, home, editor, article, settings
    fixtures/      base.ts, conduit.ts
    data/conduit/  userFactory, articleFactory
  tests/
    e2e/conduit/<feature>/
    api/conduit/<feature>/
  infra/conduit/   compose.yml
  scripts/         guard
  private/         gitignored; own git repo; mirrors src/ and tests/ layout for UAT
  playwright.config.ts  tsconfig.json  eslint.config.ts  .env.example  .nvmrc  .npmrc
```

Layering (enforced, no cycles): `config <- utils <- data <- api/components <- pages <- fixtures <- tests`. `private/` follows the same layering and imports only one way: `private -> core`.

Path aliases in tsconfig: `@config`, `@utils`, `@api`, `@components`, `@pages`, `@fixtures`, `@data`, `@uat/*` (-> `private/*`). No deep relative imports.

Extension point: `src/fixtures/base.ts` exports the AUT-agnostic `test` (`test.extend`). `conduit.ts` and `private/` fixtures extend it. Core never imports `@uat/*`.

Leak guards:
- ESLint `no-restricted-imports`: core may not import `@uat/*` or `private/`.
- CI `quality` job runs on a clean clone without `private/`.
- Pre-push `scripts/guard` (Node script): denylist of UAT hosts and names, check `private/` is not tracked.
- gitleaks in public CI only (binary may be blocked on the company laptop).
- `.gitignore`: `private/`, `.auth/`, `.env*` except `.env.example`.

Residual risk (manual discipline, not toolable): core changes discovered while working on UAT must be made in the public repo, not in `private/`.

## 3. Config and environment

- `src/config/env.ts` loads `.env` and validates with a zod schema. Result is a typed, read-only `env`. On invalid or missing variables, fail fast before Playwright starts, listing all problems at once.
- Generic variable names so core stays AUT-agnostic: `AUT`, `BASE_URL`, `API_URL`, plus per-AUT variables validated only when that AUT is selected (UAT credentials: `AUTH_USERNAME`, `AUTH_PASSWORD`).
- `.env.example` carries Conduit local values (non-secret). UAT values live in `private/.env`, gitignored.
- Loader: `process.loadEnvFile` on a pinned Node LTS (>= 22). If verification (section 10) shows it is unsuitable, use `dotenv` instead.

## 4. Authentication and isolation

- Per-worker auth (Playwright "one account per parallel worker"): a worker-scoped fixture registers the worker's user via API, logs in once through the UI (`LoginPage`) and writes `storageState` to `.auth/<aut>-<parallelIndex>.json` (gitignored); the `storageState` fixture points to it. Browser, API clients and teardown act as the same user. Regenerated every run, no stale state reuse. A shared `setup` project was rejected: it signs the browser in as a different user than the per-worker API user.
- Conduit adapter registers a unique user per worker via API (worker-scoped fixture), so there are no shared credentials and no manual seed.
- API project uses a worker-scoped fixture that obtains a token through the request context; no storageState.
- Isolation rules: every test creates its own data via API using factory-generated unique values and removes it in fixture teardown. No order dependence, no shared mutable state, parallel-safe. Tests that mutate user-level state (profile, follow, settings) use the per-worker user.

## 5. Layer rules

| Layer | Contains | Forbidden |
|---|---|---|
| components | Constructed with a root `Locator` (scoped). Locators, `verify*`, atomic actions. | Page knowledge |
| pages | Compose components. Own locators, `verify*`, atomic `fill*`/`click*`. | Business-flow methods (e.g. `login(user, pass)`) |
| api | Thin `APIRequestContext` wrapper; responses parsed with zod inside the client. | UI or test assertions |
| fixtures | Inject pages, components, clients, data. API-based teardown. | Business assertions |
| tests | Call actions one by one, each in `test.step('<label>')`. | `new` page/client, raw locators, importing `@playwright/test` directly |

Locator priority: `getByRole` > `getByLabel` > `getByTestId` > `getByText` > CSS. XPath only as last resort with a reason. Web-first assertions only. No `waitForTimeout`, no manual sleeps. Tests import `test`/`expect` from `@fixtures/conduit`.

Initial components are only those Conduit needs: `Navbar`, `ArticleList`, `Pagination`, `ErrorList`. Modal, button, table components are built only when a test requires them.

Data: factories use `crypto.randomUUID()` for unique values. No faker until realistic data is required.

## 6. Playwright config

- `fullyParallel: true`, `forbidOnly` in CI, local `retries: 0`, CI `retries: 1` used only for flake detection. A test passing on retry is reported `flaky` and treated as a quality failure.
- `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`. Reporters: `list` + `html`; CI adds `junit`.
- Explicit small timeouts (`expect`, `actionTimeout`, `navigationTimeout`). Raising timeouts is not a fix for flakiness.
- Projects: `unit`, `conduit-e2e` (chromium), `conduit-api` (no browser, no storageState), `uat-*` registered only when `private/` exists and `AUT=uat`.
- AUT lifecycle: no `webServer` (Playwright requires `webServer.command` and applies it to every project, which would block `unit`). Containers are started explicitly with `npm run aut:up` (`docker compose up --wait` on healthchecks) / `aut:down`; CI waits with `scripts/aut-wait.mjs`.

## 7. Tooling and quality gates

- `tsconfig`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `paths` aliases.
- ESLint flat config: `typescript-eslint` strict type-checked + `eslint-plugin-playwright`. Rules to enable (names checked against pinned plugin version): `no-wait-for-timeout`, `no-force-option`, `no-nth-methods`, `missing-playwright-await`, `expect-expect`, `no-conditional-in-test`, `valid-title`.
- Layering via per-directory `no-restricted-imports` overrides. Also forbidden: `any`, `@uat/*` from core, and `@playwright/test` outside `src/fixtures` except type imports everywhere and `expect` in `src/components`/`src/pages` (needed by web-first `verify*`).
- Known gap: "every action wrapped in `test.step`" is not enforceable by stock lint rules. Enforced by review; custom rule only if violations recur.
- Hooks: `simple-git-hooks` + `lint-staged`. Pre-commit: `tsc --noEmit` + ESLint. Pre-push: `scripts/guard`.
- Reproducibility: exact versions pinned (`save-exact=true`), `engines` + `.nvmrc`, committed lockfile, `npm ci`.
- Scripts: `typecheck`, `lint`, `test`, `test:e2e`, `test:api`, `test:stability` (`--repeat-each=5 --workers=4`), `aut:up`, `aut:down`, `guard`.

Built-ins used instead of custom code: HTML reporter, trace, screenshot/video on failure, `test.step`, `testInfo.attach`, `expect.toPass`/`expect.poll`, `page.waitForEvent('download')`, `expect.soft`, projects, fixtures with `auto: true`. Custom code is added only when a built-in is proven insufficient, with the reason stated.

## 8. Conduit AUT (`infra/conduit/`)

- `compose.yml`: images pinned to tag/digest, healthcheck, ports from env, multi-arch, low RAM.
- Frontend/backend implementation pair is selected during planning from upstream sources and pinned.
- Risk: an unstable Conduit implementation causes AUT-induced flakiness. Fallback: a small deterministic mock AUT inside the repo.

## 9. CI (showcase, GitHub Actions)

- `quality`: `npm ci`, `tsc --noEmit`, ESLint, `guard`, gitleaks, on a clean clone without `private/`.
- `test`: `aut:up`, wait for health, `test:e2e` + `test:api`, upload HTML report and traces as artifacts.
- `stability`: `--repeat-each=5 --workers=4`; scheduled and manual, not per PR.
- UAT CI via self-hosted runner inside the VPN: not built now; only kept possible by env- and project-driven design.

## 10. Verification items (resolve in the plan, from Playwright/Node/package docs; do not assume)

1. `process.loadEnvFile` availability and behavior on the pinned Node LTS; otherwise `dotenv`.
2. Playwright resolves tsconfig `paths` aliases for test files and config as expected.
3. How fixtures and tests are split per project (`testMatch` per project) for conduit vs uat.
4. Conditional project registration based on `private/` existence in `playwright.config.ts`.
5. Exact `eslint-plugin-playwright` rule names and options for the pinned version.
6. Worker-scoped fixture (`scope: 'worker'`) usage and API-based teardown ordering.
7. Conduit frontend/backend pair: multi-arch images, stability, auth token storage mechanism.
8. `webServer` behavior with `reuseExistingServer` and a health URL only. Resolved: `command` is required and `webServer` is global, so it is not used (section 6).
9. Latest stable versions of Playwright, TypeScript, typescript-eslint, eslint-plugin-playwright, zod to pin.

## 11. Risks and trade-offs

| Risk | Mitigation |
|---|---|
| UAT detail leaks into public repo | Guards in section 2; core clean-clone CI |
| Core drift between public and private | Core changes made only in the public repo; private repo consumes via `private/` boundary |
| Conduit instability | Pin versions; fallback mock AUT |
| Shared-user state collisions | Per-worker registered user; per-test data via API |
| `test.step` discipline not machine-enforced | Review; custom lint rule only if needed |
| Docker unavailable on company laptop | Core has no Docker dependency; UAT verified there, Conduit on personal laptop |
