# Tarzan

Tarzan is a simple, fast team work-management platform. This repository currently implements **M0 (Foundation)** through **M3 (Projects)** from the product specification in `docs/`.

## What is included

- npm workspaces for the web app, API, and shared packages
- React, TypeScript, Vite, and Tailwind CSS frontend
- NestJS and TypeScript REST API with `GET /api/health`
- PostgreSQL persistence through Prisma migrations
- Secure registration, login, logout, session restoration, and protected routes
- Bcrypt password hashing and JWT authentication in HttpOnly SameSite cookies
- Team creation with automatic creator-admin membership
- Team member listing, role assignment, removal, and authorization boundaries
- Team-scoped project creation, listing, detail views, and editing
- Docker Compose services for PostgreSQL, the API, and the web app
- ESLint, Prettier, Vitest, type checking, and production builds

Tasks and later product milestones have not been implemented yet.

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
npm run smoke:teams
npm run smoke:projects
```

To apply formatting, run `npm run format`.

Run the smoke commands while the complete Docker stack is running. They create unique development-only accounts and verify the real authentication, team, and project lifecycles through Nginx, the API, and PostgreSQL.

## Authentication API

| Method | Endpoint             | Purpose                   |
| ------ | -------------------- | ------------------------- |
| `POST` | `/api/auth/register` | Create and sign in a user |
| `POST` | `/api/auth/login`    | Sign in                   |
| `POST` | `/api/auth/logout`   | Invalidate the session    |
| `GET`  | `/api/auth/me`       | Return the signed-in user |

The browser session uses a 24-hour JWT stored in an HttpOnly, SameSite=Lax cookie. Logout increments the user's token version, so a copied pre-logout token cannot be reused.

## Teams API

| Method   | Endpoint                         | Purpose                       |
| -------- | -------------------------------- | ----------------------------- |
| `POST`   | `/api/teams`                     | Create a team                 |
| `GET`    | `/api/teams`                     | List the current user's teams |
| `GET`    | `/api/teams/:id`                 | Get a team and its members    |
| `POST`   | `/api/teams/:id/members`         | Add a registered user         |
| `DELETE` | `/api/teams/:id/members/:userId` | Remove a team member          |

Team creators become admins automatically. Only team admins can add or remove members, non-members cannot read team data, and the final team admin cannot be removed.

## Projects API

| Method  | Endpoint            | Purpose                                    |
| ------- | ------------------- | ------------------------------------------ |
| `POST`  | `/api/projects`     | Create a project in an administered team   |
| `GET`   | `/api/projects`     | List the current user's visible projects   |
| `GET`   | `/api/projects/:id` | Get a visible project's details            |
| `PATCH` | `/api/projects/:id` | Update a project as one of its team admins |

Pass `teamId` as an optional query parameter to filter the project list. Every team member can list and view that team's projects; only team admins can create or edit them. Projects are deleted automatically if their owning team is deleted.

## Database workflow

M1 introduces the `User` model, M2 adds `Team` and `TeamMember`, and M3 adds `Project`. The API container automatically runs all checked-in migrations with `prisma migrate deploy` before it starts.

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
- Self-registered users start with the global `MEMBER` role. Team administration is scoped independently through each membership.
- Authentication cookies last 24 hours and are invalidated server-side on logout.
- Team membership requires an existing registered account; invitations and email notifications remain outside the MVP.
- Project write access follows the owning team's admin role; regular team members have read-only project access.
- Product database models continue to be introduced by their owning milestones, avoiding premature migrations.
