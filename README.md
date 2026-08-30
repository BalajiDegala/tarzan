# Tarzan

Tarzan is a simple, fast team work-management platform. This repository currently implements **M0 (Foundation)** and **M1 (Authentication)** from the product specification in `docs/`.

## What is included

- npm workspaces for the web app, API, and shared packages
- React, TypeScript, Vite, and Tailwind CSS frontend
- NestJS and TypeScript REST API with `GET /api/health`
- PostgreSQL persistence through Prisma migrations
- Secure registration, login, logout, session restoration, and protected routes
- Bcrypt password hashing and JWT authentication in HttpOnly SameSite cookies
- Docker Compose services for PostgreSQL, the API, and the web app
- ESLint, Prettier, Vitest, type checking, and production builds

Teams, projects, tasks, and later product milestones have not been implemented yet.

## Prerequisites

- Node.js 22.12 or newer
- npm 10 or newer
- Docker Desktop or another Docker Compose-compatible runtime

## Local development

From the repository root:

```powershell
Copy-Item .env.example .env
npm install
docker compose up -d db
npm run prisma:generate
npm run prisma:migrate:deploy
npm run dev
```

Open the web app at `http://localhost:5173` and create an account. The API health endpoint is available at `http://localhost:3000/api/health`.

The development command starts both workspaces with watch mode. PostgreSQL data is retained in the `tarzan_postgres_data` Docker volume.

## Run the complete stack in Docker

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Open `http://localhost:5173`. The Nginx web container proxies `/api/*` to the API container.

To stop the stack without deleting database data:

```powershell
docker compose down
```

## Quality checks

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
docker compose config --quiet
npm run smoke:auth
```

To apply formatting, run `npm run format`.

Run `npm run smoke:auth` while the complete Docker stack is running. It creates a unique development-only account and verifies registration, cookie security flags, current-user access, logout invalidation, and login.

## Authentication API

| Method | Endpoint             | Purpose                   |
| ------ | -------------------- | ------------------------- |
| `POST` | `/api/auth/register` | Create and sign in a user |
| `POST` | `/api/auth/login`    | Sign in                   |
| `POST` | `/api/auth/logout`   | Invalidate the session    |
| `GET`  | `/api/auth/me`       | Return the signed-in user |

The browser session uses a 24-hour JWT stored in an HttpOnly, SameSite=Lax cookie. Logout increments the user's token version, so a copied pre-logout token cannot be reused.

## Database workflow

M1 introduces the `User` model and the first checked-in migration. The API container automatically runs `prisma migrate deploy` before it starts.

After a future schema change:

```powershell
npm run prisma:migrate:dev -- --name describe_the_change
npm run prisma:generate
```

## Environment variables

Copy `.env.example` to `.env` and change local credentials if needed. Never commit `.env`.

| Variable            | Purpose                   | Default                     |
| ------------------- | ------------------------- | --------------------------- |
| `POSTGRES_DB`       | PostgreSQL database       | `tarzan`                    |
| `POSTGRES_USER`     | PostgreSQL user           | `tarzan`                    |
| `POSTGRES_PASSWORD` | Local PostgreSQL password | `tarzan_local_password`     |
| `POSTGRES_PORT`     | Host PostgreSQL port      | `5432`                      |
| `DATABASE_URL`      | Prisma connection URL     | local Tarzan database       |
| `API_PORT`          | Host API port             | `3000`                      |
| `WEB_PORT`          | Host web port             | `5173`                      |
| `VITE_API_URL`      | Browser API base URL      | `http://localhost:3000/api` |
| `WEB_ORIGIN`        | Allowed browser origin    | `http://localhost:5173`     |
| `JWT_SECRET`        | JWT signing secret        | local development value     |
| `COOKIE_SECURE`     | HTTPS-only auth cookies   | `false`                     |

Use a unique, randomly generated `JWT_SECRET` of at least 32 characters in every deployed environment. Set `COOKIE_SECURE=true` when serving over HTTPS.

## Repository layout

```text
apps/
  api/       NestJS REST API
  web/       React/Vite frontend
packages/
  config/    Shared runtime configuration
  types/     Shared TypeScript contracts
prisma/      Prisma schema and migrations
docker/      Production container definitions
docs/        Product requirements and technical specification
```

## Current assumptions

- npm workspaces are sufficient for the initial monorepo; no additional task runner is needed yet.
- PostgreSQL 16 is the baseline database version.
- The web app uses Nginx in the production container and Vite during development.
- Self-registered users start with the global `MEMBER` role; admin provisioning and team roles are owned by M2 and seed-data hardening.
- Authentication cookies last 24 hours and are invalidated server-side on logout.
- Product database models continue to be introduced by their owning milestones, avoiding premature migrations.
