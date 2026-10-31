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
docs/            ARCHITECTURE.md
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
| `npm run mask:snapshot -- <file>` | Masks the page data in a Playwright error file before sharing it |

## Architecture

Layering, test isolation, the private extension point and the decision log live in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). In short: `config <- utils <- data <- api / components <- pages <- fixtures <- tests`, enforced by ESLint and `npm run verify:lint`; each worker gets its own API-created user; `private/` is gitignored, its own repo, and guarded by `npm run guard`.

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
