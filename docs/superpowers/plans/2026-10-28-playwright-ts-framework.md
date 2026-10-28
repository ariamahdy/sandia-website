# Playwright + TypeScript Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade Playwright + TypeScript (strict) web UI + API framework whose AUT-agnostic core is proven against a self-hosted Conduit AUT, with a gitignored `private/` extension point for company UAT.

**Architecture:** Layered `config <- utils <- api/components <- pages <- fixtures <- tests`, enforced by ESLint `no-restricted-imports`. Fixtures inject everything; tests call atomic actions inside `test.step`. Data is created and removed through API clients; auth uses a `setup` project writing `storageState`.

**Tech Stack:** Node 26 LTS, `@playwright/test` 1.64.1, TypeScript 6.0.3, typescript-eslint 8.72.1, ESLint 10.13.0, eslint-plugin-playwright 2.12.1, zod 4.6.7, simple-git-hooks 2.14.0, lint-staged 17.6.0, jiti 2.7.0.

**Spec:** `docs/superpowers/specs/2026-10-28-playwright-ts-framework-design.md`

## Global Constraints

- Strict TS: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`. No `any`. No code comments.
- Layering (no cycles): `config <- utils <- api/components <- pages <- fixtures <- tests`. Core never imports `@uat/*` or `private/`.
- Aliases: `@config`, `@utils`, `@api`, `@components`, `@pages`, `@fixtures`, `@data`, `@uat/*` (-> `private/*`). No deep relative imports.
- Tests import `test`/`expect` only from `@fixtures/conduit` (exception: `tests/unit/**`, which imports `@playwright/test`).
- Locator priority: `getByRole` > `getByLabel` > `getByTestId` > `getByText` > CSS; XPath last resort with reason. Web-first assertions. No `waitForTimeout`.
- No hard-coded URLs or secrets; everything from env.
- Exact versions pinned: `.npmrc` `save-exact=true`, `engines.node` `>=26.12.1 <27`, `.nvmrc` `26`, lockfile committed, `npm ci`.
- TypeScript is pinned to 6.0.3, not the newest release, because typescript-eslint 8.72.1 declares peer `typescript >=4.8.4 <6.1.0`.
- Definition of done per task: `npm run typecheck` 0 errors, `npm run lint` 0 errors/warnings, affected tests pass; from Task 10 on also `npm run test:stability`.
- Docker exists only on the personal laptop. Only Task 4 and the Conduit suites need it.
- Plan-level addition to the spec: a `unit` Playwright project (`tests/unit`) for pure core logic, so no extra test runner is added.

## Review Focus

- Missing and invalid env vars together: one aggregated error naming every problem (Task 2).
- `AUT=uat` while `private/` is absent: clear error, not a module-resolution crash (Task 3).
- Four workers registering users at once: no email/username collision (Task 7).
- Test deletes its own article, then fixture teardown runs: teardown must tolerate 404 (Task 7).
- Backend response missing a field: zod failure names the endpoint (Task 6).

---

### Task 1: Scaffold, toolchain, lint rules

**Files:**
- Create: `package.json`, `.npmrc`, `.nvmrc`, `.gitignore`, `tsconfig.json`, `eslint.config.ts`, `.env.example`, `scripts/verify-lint-rules.mjs`
- Create: minimal `playwright.config.ts` with only the `unit` project (`testDir: tests/unit`), so Task 2 tests can run; Task 3 expands it

**Interfaces:**
- Produces: npm scripts `typecheck` (`tsc --noEmit`), `lint` (`eslint . --max-warnings=0`), `verify:lint`, `test`, `test:unit`, `test:e2e`, `test:api`, `test:stability` (`playwright test --repeat-each=5 --workers=4 --project=conduit-api --project=conduit-e2e`), `aut:up`, `aut:down`, `guard`.
- Produces: tsconfig `paths` for all aliases in Global Constraints; ESLint flat config exporting layer rules.

- [ ] **Step 1: Write the failing check `scripts/verify-lint-rules.mjs`**

Uses the ESLint Node API to lint in-memory snippets with a virtual `filePath` and asserts rule ids:
- `src/pages/x.ts` importing `@fixtures/conduit` -> `no-restricted-imports`
- `src/config/x.ts` importing `@uat/anything` -> `no-restricted-imports`
- `src/pages/x.ts` importing `@playwright/test` (not `Locator` type-only) -> `no-restricted-imports`
- `tests/e2e/x.spec.ts` importing `@playwright/test` -> `no-restricted-imports`
- `tests/e2e/x.spec.ts` containing `await page.waitForTimeout(1)` -> `playwright/no-wait-for-timeout`
- any file with `const a: any = 1` -> `@typescript-eslint/no-explicit-any`
- `tests/unit/x.spec.ts` importing `@playwright/test` -> no error

- [ ] **Step 2: Run `node scripts/verify-lint-rules.mjs`**

Expected: FAIL (no ESLint config yet).

- [ ] **Step 3: Install and configure**

`npm i -D -E` the Tech Stack packages plus `@eslint/js@^10` and `@types/node@26`; `npm i -E zod@4.6.7`. Write `tsconfig.json` (module `NodeNext` unless Playwright resolution requires otherwise; verify with Task 3 smoke), `eslint.config.ts` using `typescript-eslint` strict type-checked + `eslint-plugin-playwright` rules: `no-wait-for-timeout`, `no-force-option`, `no-nth-methods`, `missing-playwright-await`, `expect-expect`, `no-conditional-in-test`, `valid-title`, `no-networkidle`, `no-skipped-test`, `no-focused-test` (rule names verified present in eslint-plugin-playwright 2.12.1). Layer rules via per-directory `no-restricted-imports` overrides encoding the DAG.

- [ ] **Step 4: Run `npm run verify:lint && npm run typecheck && npm run lint`**

Expected: all pass.

- [ ] **Step 5: Commit** `git add -A && git commit -m "chore: scaffold toolchain and layer lint rules"`

---

### Task 2: Env config

**Files:**
- Create: `src/config/env.ts`, `src/config/index.ts`
- Test: `tests/unit/config/env.spec.ts`

**Interfaces:**
- Produces: `type Env = { AUT: 'conduit' | 'uat'; BASE_URL: string; API_URL: string } & ({ AUT: 'conduit' } | { AUT: 'uat'; AUTH_USERNAME: string; AUTH_PASSWORD: string })` (zod discriminated union on `AUT`).
- Produces: `class ConfigError extends Error { readonly issues: readonly string[] }`
- Produces: `loadEnv(source?: NodeJS.ProcessEnv): Env` (pure, defaults to `process.env`), `loadEnvFile(path: string): void` (calls `process.loadEnvFile` only if the file exists; verified present on Node 26.12.1), `env: Env` exported from `@config` (evaluated on import, fail fast).

- [ ] **Step 1: Write failing tests** in `tests/unit/config/env.spec.ts`, then run `npx playwright test tests/unit/config --project=unit` -> FAIL (module missing). Tests:
  - valid conduit env returns `{ AUT: 'conduit', BASE_URL, API_URL }`
  - `{}` throws `ConfigError` whose `issues` contains `AUT`, `BASE_URL`, `API_URL` (Review Focus 1)
  - `AUT=uat` without credentials: `issues` contains `AUTH_USERNAME` and `AUTH_PASSWORD`
  - `BASE_URL=not-a-url` -> issue names `BASE_URL`
  - result object is frozen (`Object.isFrozen`)

- [ ] **Step 2: Implement** `loadEnv` with `safeParse`; map zod issues to `"<path>: <message>"` strings; throw one `ConfigError` with all issues; `Object.freeze` the result.

- [ ] **Step 3: Verify:** `npx playwright test tests/unit/config --project=unit` -> PASS; `npm run typecheck && npm run lint`.

- [ ] **Step 4: Commit** `feat: validated env config`

---

### Task 3: Playwright config and project wiring

**Files:**
- Create: `playwright.config.ts`, `tests/unit/config/projects.spec.ts`, `src/config/projects.ts`
- Modify: `.env.example` (Conduit local values: `AUT=conduit`, `BASE_URL`, `API_URL`)

**Interfaces:**
- Consumes: `env`, `loadEnvFile` from `@config`.
- Produces: `buildProjects(opts: { aut: Env['AUT']; hasPrivate: boolean }): readonly Project[]` in `src/config/projects.ts` (pure; throws `ConfigError` with message containing `private/` when `aut === 'uat' && !hasPrivate`, Review Focus 2).
- Projects: `unit` (`testDir: tests/unit`), `setup` (`testMatch: tests/setup/*.setup.ts`), `conduit-e2e` (chromium, `dependencies: ['setup']`, `testDir: tests/e2e/conduit`, `storageState: .auth/conduit.json`), `conduit-api` (`testDir: tests/api/conduit`, no browser), `uat-e2e`/`uat-api` only when `private/` exists and `AUT=uat` (testDirs under `private/tests`).
- Global config: `fullyParallel: true`, `forbidOnly: !!process.env.CI`, `retries: process.env.CI ? 1 : 0`, `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`, reporters `list`+`html` (+`junit` in CI), explicit `expect.timeout`, `actionTimeout`, `navigationTimeout` (values chosen small, recorded in the file), `webServer` with `url: env.BASE_URL`, `reuseExistingServer: true`, no `command`.

- [ ] **Step 1: Write failing tests** `projects.spec.ts`:
  - `buildProjects({aut:'conduit',hasPrivate:false})` names equal `['unit','setup','conduit-e2e','conduit-api']`
  - `conduit-e2e` has `dependencies` equal `['setup']`
  - `buildProjects({aut:'uat',hasPrivate:false})` throws `ConfigError` matching `/private\//`
  - `buildProjects({aut:'uat',hasPrivate:true})` includes `uat-e2e` and `uat-api`

- [ ] **Step 2: Run** `npx playwright test tests/unit/config/projects.spec.ts --project=unit` -> FAIL (module missing). `playwright.config.ts` calls `loadEnvFile('.env')` before reading `env`.

- [ ] **Step 3: Implement** `buildProjects` and `playwright.config.ts` (existence check via `fs.existsSync('private')`). Smoke-verify here (spec items 2 and 4): a config import using `@config` resolves under Playwright's transform; if not, record the working `tsconfig` setting in the tsconfig and re-run.

- [ ] **Step 4: Run** `npx playwright test --project=unit` -> PASS (Task 2 and Task 3 tests). Then `npm run typecheck && npm run lint`.

- [ ] **Step 5: Commit** `feat: playwright config with project wiring`

---

### Task 4: Conduit AUT infra (requires Docker, personal laptop)

**Files:**
- Create: `infra/conduit/compose.yml`, `infra/conduit/README.md`, `scripts/aut-wait.mjs`
- Modify: `package.json` (`aut:up`, `aut:down`), `.env.example`

**Interfaces:**
- Produces: running UI at `BASE_URL`, REST API at `API_URL` (RealWorld spec: `/users`, `/users/login`, `/user`, `/articles`, `/articles/:slug`, `/tags`).
- Produces: recorded decision in `infra/conduit/README.md`: chosen frontend+backend pair, image tags/digests, auth header scheme (`Token` per RealWorld spec, or `Bearer` if the chosen backend differs), where the frontend stores the JWT (localStorage key or cookie).
- Produces: `aut-wait.mjs <url> <timeoutSeconds>` exits 0 when the URL returns HTTP 200, else exit 1 with the last status.

- [ ] **Step 1: Select the pair (spec item 7).** From the RealWorld implementations list at `github.com/gothinkster/realworld`, shortlist implementations that ship Dockerfile/compose and a TypeScript-friendly REST backend. For each candidate run `docker manifest inspect <image>` and require both `linux/amd64` and `linux/arm64`. A candidate passes only if its API answers `GET /api/tags` with 200 and its UI registers a user. Time-box: if no candidate passes, implement the fallback mock AUT in `infra/conduit/mock/` (Express-free: Node `http` server implementing only the five endpoints used by Tasks 6-10 plus a static page with the same `getByRole` landmarks) and record why.

- [ ] **Step 2: Write `compose.yml`:** images pinned to tag+digest, `healthcheck`, ports from env, `mem_limit` set.

- [ ] **Step 3: Verify:** `npm run aut:up && node scripts/aut-wait.mjs $BASE_URL 120 && curl -sf $API_URL/tags` -> exit 0; `npm run aut:down`.

- [ ] **Step 4: Commit** `feat: conduit AUT via compose`

---

### Task 5: Utils and data factories

**Files:**
- Create: `src/utils/string.ts`, `src/data/conduit/user.factory.ts`, `src/data/conduit/article.factory.ts`, `src/data/conduit/index.ts`
- Test: `tests/unit/data/factories.spec.ts`

**Interfaces:**
- Produces: `uniqueId(prefix: string): string` (`${prefix}-${crypto.randomUUID()}`, lower-case).
- Produces: `type NewUser = { username: string; email: string; password: string }`, `buildUser(overrides?: Partial<NewUser>): NewUser` (email `<username>@example.test`, password length >= 12).
- Produces: `type NewArticle = { title: string; description: string; body: string; tagList: string[] }`, `buildArticle(overrides?: Partial<NewArticle>): NewArticle`.

- [ ] **Step 1: Write failing tests:** two `buildUser()` calls differ in `username` and `email`; overrides win; `buildArticle().title` unique across 1000 calls (`new Set(...).size === 1000`).
- [ ] **Step 2: Run** -> FAIL.
- [ ] **Step 3: Implement** as specified.
- [ ] **Step 4: Run** -> PASS; typecheck + lint.
- [ ] **Step 5: Commit** `feat: data factories`

---

### Task 6: HTTP client and Conduit API clients

**Files:**
- Create: `src/api/http-client.ts`, `src/api/conduit/schemas.ts`, `src/api/conduit/auth.client.ts`, `src/api/conduit/articles.client.ts`, `src/api/conduit/index.ts`
- Test: `tests/unit/api/http-client.spec.ts`

**Interfaces:**
- Consumes: `NewUser`, `NewArticle` (`@data`), `Env` (`@config`).
- Produces: `class ApiError extends Error { readonly endpoint: string; readonly status: number }`; `class ContractError extends Error { readonly endpoint: string; readonly issues: readonly string[] }`.
- Produces: `async function parseResponse<T>(endpoint: string, response: APIResponse, schema: z.ZodType<T>): Promise<T>` in `http-client.ts` (throws `ApiError` on non-2xx, `ContractError` on schema mismatch).
- Produces: `createApiContext(baseURL: string, token?: string): Promise<APIRequestContext>` (sets header from the scheme recorded in Task 4; caller disposes).
- Produces: `class AuthClient { constructor(ctx: APIRequestContext); register(user: NewUser): Promise<ConduitUser>; login(email: string, password: string): Promise<ConduitUser> }` where `ConduitUser = { username: string; email: string; token: string }`.
- Produces: `class ArticlesClient { constructor(ctx: APIRequestContext); create(a: NewArticle): Promise<ConduitArticle>; get(slug: string): Promise<ConduitArticle>; remove(slug: string): Promise<void> }` where `ConduitArticle = { slug: string; title: string; description: string; body: string; tagList: string[]; author: { username: string } }`.

- [ ] **Step 1: Write failing tests** with a fake `APIResponse` object typed via `Pick<APIResponse, 'ok' | 'status' | 'json'>`: non-2xx -> `ApiError` with `status` 404 and `endpoint` `'GET /articles/x'`; body missing `article.slug` -> `ContractError` whose `endpoint` equals the passed endpoint and `issues` mention `slug` (Review Focus 5); valid body returns parsed value.
- [ ] **Step 2: Run** -> FAIL.
- [ ] **Step 3: Implement** zod schemas in `schemas.ts` for the response shapes above; clients call `ctx.post/get/delete` and `parseResponse`; `remove` accepts 2xx only.
- [ ] **Step 4: Run** -> PASS; typecheck + lint.
- [ ] **Step 5: Commit** `feat: typed API clients with contract validation`

---

### Task 7: Fixtures

**Files:**
- Create: `src/fixtures/base.ts`, `src/fixtures/conduit.ts`
- Test: `tests/api/conduit/fixtures/isolation.spec.ts`

**Interfaces:**
- Consumes: `env`, `createApiContext`, `AuthClient`, `ArticlesClient`, `buildUser`, `buildArticle`.
- Produces from `base.ts`: `test` (`test.extend<{}, { env: Env }>` with worker-scoped `env`), `expect`.
- Produces from `conduit.ts`: `test`, `expect` with
  - worker-scoped `workerUser: ConduitUser` (registers a unique user, `scope: 'worker'`)
  - `api: { auth: AuthClient; articles: ArticlesClient }` (per test, authenticated with `workerUser.token`, context disposed on teardown)
  - `article: ConduitArticle` (created via API from `buildArticle()`; teardown calls `remove` and ignores `ApiError` with `status === 404`, Review Focus 4)
  - page/component fixtures are added in Task 9.

- [ ] **Step 1: Write failing tests** `isolation.spec.ts`:
  - `workerUser` is registered: `api.auth.login(workerUser.email, <password>)` succeeds (password exposed via a `workerCredentials` read-only fixture)
  - test using `article` can read it: `(await api.articles.get(article.slug)).title === article.title`
  - test that calls `api.articles.remove(article.slug)` itself passes (teardown tolerates 404)
  - two tests in the same file each see only their own article: `article.title` is unique per test, and each test asserts `api.articles.get(article.slug)` returns that exact title
- [ ] **Step 2: Run** `npx playwright test tests/api/conduit/fixtures --project=conduit-api` -> FAIL.
- [ ] **Step 3: Implement** fixtures as specified. Registering uses `buildUser()` so 4 parallel workers never collide (Review Focus 3).
- [ ] **Step 4: Run** `npx playwright test tests/api/conduit/fixtures --project=conduit-api --repeat-each=5 --workers=4` -> PASS (needs `aut:up`).
- [ ] **Step 5: Commit** `feat: base and conduit fixtures`

---

### Task 8: API test suite

**Files:**
- Create: `tests/api/conduit/auth/auth.spec.ts`, `tests/api/conduit/articles/articles.spec.ts`

**Interfaces:**
- Consumes: Task 7 fixtures. Test titles use the form `API-AUTH-001 ...`, `API-ART-001 ...` (new ID scheme; no Katalon traceability).

- [ ] **Step 1: Write tests** (each action inside `test.step`):
  - `API-AUTH-001 register returns a token`: `api.auth.register(buildUser())` -> `token` non-empty
  - `API-AUTH-002 login with wrong password is rejected`: `expect(api.auth.login(workerCredentials.email, 'wrong-password-123')).rejects.toMatchObject({ status: 422 })` (adjust to the status recorded in Task 4)
  - `API-ART-001 create then fetch article`
  - `API-ART-002 deleted article is not retrievable`: after `remove`, `expect(api.articles.get(slug)).rejects.toMatchObject({ status: 404 })`
- [ ] **Step 2: Run** `npm run test:api` -> PASS (needs `aut:up`); then `npx playwright test --project=conduit-api --repeat-each=5 --workers=4` -> PASS.
- [ ] **Step 3: Commit** `test: conduit API suite`

---

### Task 9: Components, pages, UI fixtures

**Files:**
- Create: `src/components/{navbar,article-list,pagination,error-list}.component.ts`, `src/components/index.ts`
- Create: `src/pages/conduit/{login,register,home,editor,article,settings}.page.ts`, `src/pages/conduit/index.ts`
- Modify: `src/fixtures/conduit.ts` (add page and component fixtures)

**Interfaces:**
- Components take `constructor(root: Locator)`; expose only locators, `verify*`, atomic actions. Required members:
  - `Navbar`: `verifySignedIn(username: string): Promise<void>`, `verifySignedOut(): Promise<void>`, `clickNewArticle(): Promise<void>`, `clickSettings(): Promise<void>`
  - `ErrorList`: `verifyMessage(text: string | RegExp): Promise<void>`
  - `ArticleList`: `verifyContainsTitle(title: string): Promise<void>`, `openByTitle(title: string): Promise<void>`
  - `Pagination`: built only if Task 10 uses it; otherwise omitted (YAGNI)
- Pages take `constructor(page: Page)`, expose `goto(): Promise<void>` and atomic actions: `LoginPage.fillEmail/fillPassword/clickSignIn`, `EditorPage.fillTitle/fillDescription/fillBody/fillTags/clickPublish`, `ArticlePage.verifyTitle/clickDelete`, `HomePage.navbar`, `HomePage.articleList`. No method combines several actions.
- Fixtures added: `loginPage`, `registerPage`, `homePage`, `editorPage`, `articlePage`, `settingsPage` (only those used by Task 10 tests).
- Locators prefer `getByRole`/`getByLabel`/`getByPlaceholder`; any `getByTestId`/CSS/XPath choice carries its reason in the commit message (no code comments).

- [ ] **Step 1: Write the failing UI test** `tests/e2e/conduit/smoke/home.spec.ts`: `E2E-HOME-001 home page loads signed in`: `homePage.goto()` then `homePage.navbar.verifySignedIn(workerUser.username)`.
- [ ] **Step 2: Run** `npx playwright test tests/e2e/conduit/smoke --project=conduit-e2e` -> FAIL (needs Task 10's setup; run once Step 3 of Task 10 exists, or temporarily with `--project=conduit-e2e --no-deps` after seeding storageState by hand).
- [ ] **Step 3: Implement** components, pages, fixtures per Interfaces.
- [ ] **Step 4: Run** after Task 10 -> PASS; typecheck + lint.
- [ ] **Step 5: Commit** `feat: components, pages and UI fixtures`

---

### Task 10: Auth setup and E2E suite

**Files:**
- Create: `tests/setup/auth.setup.ts`, `tests/e2e/conduit/articles/article-lifecycle.spec.ts`, `tests/e2e/conduit/auth/login.spec.ts`
- Modify: `.gitignore` (`.auth/`)

**Interfaces:**
- `auth.setup.ts` (project `setup`): registers a unique user via `AuthClient`, logs in through `LoginPage` (UI, per spec section 4), `page.context().storageState({ path: '.auth/conduit.json' })`. The UI login must be driven through fixtures, so `setup` files import `test` from `@fixtures/conduit`.
- `login.spec.ts` overrides `storageState: { cookies: [], origins: [] }` for its tests.

- [ ] **Step 1: Write failing tests**
  - `E2E-AUTH-001 login with valid credentials`: fill email, fill password, click sign in, `navbar.verifySignedIn(user.username)` (three separate `test.step`s)
  - `E2E-AUTH-002 login with wrong password shows an error`: `errorList.verifyMessage(/.+/)` per the message recorded in Task 4
  - `E2E-ART-001 create article via UI then see it on its page`: new article via `editorPage` atomic actions (one `test.step` per fill/click), `articlePage.verifyTitle(title)`; the UI-created slug is read from the page URL and passed to `trackArticle(slug)` so fixture teardown removes it
  - `E2E-ART-002 article created via API appears in the list`: uses the `article` fixture, opens home, `articleList.verifyContainsTitle(article.title)`
- [ ] **Step 2: Run** `npx playwright test --project=conduit-e2e` -> FAIL.
- [ ] **Step 3: Implement** setup and the `trackArticle: (slug: string) => void` fixture in `conduit.ts` (teardown removes tracked slugs, tolerating 404).
- [ ] **Step 4: Run** `npm run test:stability` -> PASS with 0 flaky; open the HTML report and confirm every action appears as a step. Also Task 9 Step 4.
- [ ] **Step 5: Commit** `test: auth setup and conduit E2E suite`

---

### Task 11: Guards and hooks

**Files:**
- Create: `scripts/guard.mjs`, `scripts/guard.denylist.txt`
- Modify: `package.json` (`simple-git-hooks`, `lint-staged` config, `prepare` script)

**Interfaces:**
- `guard.mjs`: exits 1 and prints the offending file:line if (a) any tracked file matches a denylist pattern (one regex per line, UAT host/name patterns kept in `private/guard.denylist.txt` and merged at runtime; the public file ships with generic examples only), (b) `git ls-files private` is non-empty, (c) any tracked file matches `.env` other than `.env.example`.
- Hooks: pre-commit `lint-staged` (`eslint --max-warnings=0` on staged `*.ts`) plus `npm run typecheck`; pre-push `npm run guard`.

- [ ] **Step 1: Write the failing check:** in a temp clone, `git add -f private/x.txt` then `node scripts/guard.mjs` must exit 1 mentioning `private/`.
- [ ] **Step 2: Run** -> FAIL (script missing).
- [ ] **Step 3: Implement** `guard.mjs` using `git ls-files` via `child_process.execFileSync`.
- [ ] **Step 4: Run** the check -> exit 1; remove the file -> exit 0. `npx simple-git-hooks` installs hooks.
- [ ] **Step 5: Commit** `feat: leak guard and git hooks`

---

### Task 12: CI and showcase README

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/stability.yml`, `README.md`

**Interfaces:**
- `ci.yml` jobs: `quality` (checkout without `private/`; `npm ci`; `typecheck`; `lint`; `verify:lint`; `guard`; gitleaks action pinned by version) and `test` (needs `quality`; `npm run aut:up`; `node scripts/aut-wait.mjs $BASE_URL 180`; `npm run test:api`; `npm run test:e2e`; upload `playwright-report/` and `test-results/` as artifacts `if: always()`).
- `stability.yml`: `schedule` + `workflow_dispatch`, runs `npm run test:stability`.
- README: setup (`nvm use`, `npm ci`, `cp .env.example .env`, `npm run aut:up`), run commands, layering diagram, `private/` model and the Definition of Done. No UAT-specific content.

- [ ] **Step 1: Write workflows and README.**
- [ ] **Step 2: Verify locally:** `npx @action-validator/cli .github/workflows/*.yml` if available, otherwise `npx yaml-lint`; then in a fresh clone without `private/` run `npm ci && npm run typecheck && npm run lint && npm run verify:lint` -> all pass (proves core independence).
- [ ] **Step 3: Commit** `ci: quality, test and stability workflows`
