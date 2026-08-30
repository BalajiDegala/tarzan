# Runbook 2: deploy Tarzan with Docker Compose

Docker Compose runs the database, API, and web server in isolated containers while giving them one private network and persistent database storage.

## 1. Understand the container topology

```text
Browser http://localhost:5173
            |
            v
web container (Nginx :80)
            | /api is proxied using Docker DNS
            v
api container (NestJS :3000)
            |
            v
db container (PostgreSQL :5432)
            |
            v
tarzan_postgres_data named volume
```

`web`, `api`, and `db` are both Compose service names and DNS names on the automatically created project network. `localhost` inside a container means that container itself, so inter-container URLs use service names instead.

## 2. Prerequisites

- Docker Desktop or Docker Engine with Compose v2
- At least 4 GB of memory available to Docker
- Node.js/npm only if you want to seed or run host-side smoke scripts

```bash
docker version
docker compose version
```

If Docker returns a named-pipe `500 Internal Server Error`, start or restart Docker Desktop and wait until the Linux engine reports ready before retrying.

## 3. Configure ports and credentials

```bash
cp .env.example .env
```

Use `POSTGRES_PORT=5433` and update `DATABASE_URL` to port `5433` when a native PostgreSQL service already owns host port `5432`:

```dotenv
POSTGRES_PORT=5433
DATABASE_URL=postgresql://tarzan:tarzan_local_password@localhost:5433/tarzan?schema=public
```

The host `DATABASE_URL` is used by Prisma and the seed script launched from your terminal. Compose constructs a separate internal database URL using host `db` and port `5432` for the API container.

Replace `JWT_SECRET` with at least 32 random characters. Local HTTP uses `COOKIE_SECURE=false`.

## 4. Build and start

```bash
docker compose up -d --build
docker compose ps
```

Expected state: all three services eventually show `healthy`. Follow startup logs while learning:

```bash
docker compose logs -f db api web
```

Press `Ctrl+C` to stop following logs; detached containers continue running.

## 5. Apply demo data

The API container automatically applies migrations before starting. Seed from the host after PostgreSQL is healthy:

```bash
npm ci
npm run prisma:generate
npm run db:seed
```

Alternatively, run the checked-in seed inside the API image:

```bash
docker compose exec api node prisma/seed.mjs
```

## 6. Verify

```bash
curl --fail http://localhost:5173/api/health
xdg-open http://localhost:5173/board >/dev/null 2>&1 &
npm run smoke:seed
```

Demo login: `admin@tarzan.local` / `TarzanDemo1!`.

Run every end-to-end flow when validating a release:

```bash
npm run smoke:auth
npm run smoke:teams
npm run smoke:projects
npm run smoke:tasks
npm run smoke:collaboration
npm run smoke:seed
```

## 7. Dockerfile explanation

Tarzan uses multi-stage builds. Build tools stay in an intermediate image; only compiled output and runtime dependencies are copied into the final image.

### `docker/api.Dockerfile`

| Instruction group                                      | Why it exists                                                                                        |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `FROM node:22-alpine AS build`                         | Provides Node/npm in a small Linux build environment.                                                |
| `WORKDIR /app`                                         | Makes all later relative paths predictable.                                                          |
| Copy only package manifests, then `npm ci`             | Produces a cacheable, deterministic dependency layer. A source edit does not reinstall dependencies. |
| Copy API, shared packages, and Prisma schema           | Adds only inputs required to compile the API.                                                        |
| `prisma:generate`                                      | Generates the database client for the target Linux environment.                                      |
| Build shared packages and API                          | Produces JavaScript in `apps/api/dist`.                                                              |
| `FROM node:22-alpine AS runtime`                       | Starts a fresh runtime stage without source build context.                                           |
| `ENV NODE_ENV=production`                              | Enables production behavior in Node dependencies.                                                    |
| Copy modules, built API, shared packages, Prisma files | Supplies the compiled server, runtime packages, and migrations.                                      |
| `EXPOSE 3000`                                          | Documents the container port; publishing is handled by Compose/Kubernetes.                           |
| `CMD ... prisma migrate deploy && node ...`            | Applies pending migrations, then uses `exec` so Node receives stop signals correctly.                |

The current runtime copies the full installed module tree because Prisma CLI is needed for startup migrations. A later optimization can install production dependencies plus a dedicated migration job.

### `docker/web.Dockerfile`

| Instruction group           | Why it exists                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| Node build stage            | Compiles TypeScript, React, Tailwind CSS, and Vite assets.                               |
| `ARG/ENV VITE_API_URL=/api` | Embeds the browser API base URL at build time. It is not a runtime environment variable. |
| Nginx runtime stage         | Serves immutable static files efficiently without Node.js.                               |
| Copy `docker/nginx.conf`    | Adds SPA routing and the `/api` reverse proxy.                                           |
| Copy `apps/web/dist`        | Places the compiled site into Nginx's document root.                                     |
| `EXPOSE 80`                 | Documents Nginx's internal port.                                                         |

### `docker/nginx.conf`

- `location /api/` proxies requests to `http://api:3000/api/` using Compose/Kubernetes DNS.
- Forwarded headers preserve the original request context.
- `try_files ... /index.html` lets React Router handle direct requests such as `/board` and `/projects`.

## 8. Compose file explanation

### Database service

- Runs the pinned `postgres:16-alpine` image.
- Gets database/user/password values from `.env` with local fallbacks.
- Publishes the database only for host tools such as Prisma and `psql`.
- Mounts the named volume at PostgreSQL's data directory.
- Uses `pg_isready` for readiness.

### API service

- Builds `docker/api.Dockerfile` from the repository root.
- Connects to database hostname `db`, never host `localhost`.
- Waits for the database health check before starting.
- Publishes container port `3000` to `API_PORT`.
- Checks `/api/health` so dependent services and operators can see readiness.

### Web service

- Builds the static site with `VITE_API_URL=/api`.
- Waits for a healthy API.
- Publishes Nginx port `80` to `WEB_PORT` (default `5173`).
- Proxies browser API calls internally, keeping the browser on one origin.

### Network and volume

Compose automatically creates a private bridge network named from the project. The named volume survives container replacement and `docker compose down`.

`depends_on` controls startup ordering here because it uses `condition: service_healthy`; it does not replace application retries or monitoring in a production platform.

## 9. Common operations

```bash
# Show containers and health
docker compose ps

# Follow one service
docker compose logs -f api

# Rebuild after source changes
docker compose up -d --build

# Restart without rebuilding
docker compose restart api web

# Open a PostgreSQL shell
docker compose exec db psql -U tarzan -d tarzan

# Inspect resolved configuration
docker compose config

# Stop while retaining database data
docker compose down
```

## 10. Data deletion and recovery

This command is destructive because `-v` removes the named PostgreSQL volume:

```bash
docker compose down -v
```

Use it only when you intentionally want an empty database. For a recoverable backup:

```bash
docker compose exec -T db pg_dump -U tarzan -d tarzan -Fc > tarzan.backup
```

Restore into an empty Tarzan database:

```bash
docker compose exec -T db pg_restore -U tarzan -d tarzan --clean --if-exists < tarzan.backup
```

## 11. Build and tag release images

Replace the placeholders with your Harbor host/project and an immutable version or Git SHA:

```bash
docker build -f docker/api.Dockerfile -t <HARBOR_HOST>/<PROJECT>/tarzan-api:<TAG> .
docker build -f docker/web.Dockerfile --build-arg VITE_API_URL=/api -t <HARBOR_HOST>/<PROJECT>/tarzan-web:<TAG> .
docker login <HARBOR_HOST>
docker push <HARBOR_HOST>/<PROJECT>/tarzan-api:<TAG>
docker push <HARBOR_HOST>/<PROJECT>/tarzan-web:<TAG>
```

Do not use mutable `latest` tags for controlled deployments. Kubernetes and Argo CD should deploy the immutable tag produced by the pipeline.

## Troubleshooting

### PostgreSQL image pull returns a Docker API 500

Confirm Docker Desktop's Linux engine is running:

```bash
docker info
docker context show
docker pull postgres:16-alpine
```

Restart Docker Desktop if `docker info` fails before changing Compose.

### A host port is already allocated

Change `POSTGRES_PORT`, `API_PORT`, or `WEB_PORT` in `.env`, then recreate:

```bash
docker compose up -d --force-recreate
```

### API is unhealthy

```bash
docker compose logs --tail=200 api
docker compose exec api wget -qO- http://127.0.0.1:3000/api/health
docker compose exec api npx --no-install prisma migrate status --schema prisma/schema.prisma
```

### Web is healthy but API calls fail

```bash
docker compose exec web wget -qO- http://api:3000/api/health
docker compose exec web nginx -T
```

This tests Docker DNS, the API Service, and the active Nginx proxy configuration separately.
