# Conduit AUT

Self-hosted RealWorld ("Conduit") app used as the public system under test.

## Run

```bash
cp .env.example .env
npm run aut:up
node scripts/aut-wait.mjs "$BASE_URL" 120
npm run aut:down
```

`aut:up` builds the images on first run, then waits for every healthcheck (`docker compose up --wait`). `aut:down -v` removes containers and data. The database lives on `tmpfs`, so every `aut:up` starts empty.

## Decision record

**No prebuilt image qualified.** Every RealWorld image found on Docker Hub (2018 to 2023) is `linux/amd64` only, which fails the multi-arch requirement. Instead, both apps are built from pinned upstream sources. A local build produces an image for the host architecture, so the same `compose.yml` runs on arm64 laptops and amd64 CI.

| Service | Source | Pin | Base images |
|---|---|---|---|
| `web` | [gothinkster/angular-realworld-example-app](https://github.com/gothinkster/angular-realworld-example-app) (Angular 21, built with Bun) | `dd99ed2cf39c805d719f943c5d7061a5683d98a8` | `node:22.23.4-bookworm-slim`, `oven/bun:1.4.4`, `nginx:1.31.8-alpine` |
| `api` | [gothinkster/node-express-realworld-example-app](https://github.com/gothinkster/node-express-realworld-example-app) (TypeScript, Express, Prisma 4) | `30b68e1e881462b2f4164ea09ab4c4f5699c7b0b` | `node:22.23.4-bookworm-slim` |
| `db` | PostgreSQL | `17.11` | `postgres:17.11-alpine` |

All base images are pinned by multi-arch index digest in `compose.yml`.

**Build changes to upstream:**
- `web`: the API base URL is hard-coded upstream (`https://api.realworld.show/api` in `src/app/core/interceptors/api.interceptor.ts`). The build rewrites it to `/api` and fails if the old host remains. nginx serves the app and proxies `/api/` to `api:3000`, so the UI and API share one origin and one port.
- `api`: built with its own Nx/esbuild target. On start it runs `prisma migrate deploy`, then `node dist/api/main.js`. `openssl` is installed for the Prisma engines.

**Facts the framework relies on:**
- `BASE_URL=http://localhost:$CONDUIT_PORT`, `API_URL=$BASE_URL/api`. Only `127.0.0.1` is bound.
- Auth header: `Authorization: Token <jwt>` (RealWorld spec). The backend also accepts `Bearer`.
- Status codes: wrong login credentials return `403`; blank email or password `422`; missing article `404`; no token `401`.
- The frontend stores the JWT in `localStorage` under the key `jwtToken`.
- Endpoints: `/users`, `/users/login`, `/user`, `/articles`, `/articles/:slug`, `/tags` under `/api`.

**Fallback:** if this pair becomes unstable and causes AUT-induced flakiness, replace it with a deterministic mock AUT in `infra/conduit/mock/` (spec section 8).
