# Tarzan

Tarzan is a simple, fast team work-management platform. This repository implements the complete **M0-M8 MVP** from the product specification in `docs/`.

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
- Task CRUD with generated keys, assignment, fixed workflow status, type, priority, due dates, and labels
- Six-column Kanban board with drag-and-drop status persistence and a list-view fallback
- Team-scoped task comments and structured activity history
- Server-side task search with status, priority, type, assignee, and label filters
- Idempotent demo data with five users, one project, twelve tasks, comments, and activity
- Confirmation for destructive task deletion and hardened environment validation
- Docker Compose services for PostgreSQL, the API, and the web app
- ESLint, Prettier, Vitest, type checking, and production builds

## Prerequisites

- Node.js 22.12 or newer
- npm 10 or newer
- Docker Desktop or another Docker Compose-compatible runtime

## Local development

From the repository root:

```bash
cp .env.example .env
npm install
docker compose up -d db
npm run prisma:generate
npm run prisma:migrate:deploy
npm run db:seed
npm run dev
```

Open the web app at `http://localhost:5173`. Team management, project management, and task delivery are separated into `/teams`, `/projects`, and `/board`. The API health endpoint is available at `http://localhost:3000/api/health`.

The development command starts both workspaces with watch mode. PostgreSQL data is retained in the `tarzan_postgres_data` Docker volume.

## Run the complete stack in Docker

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost:5173`. The Nginx web container proxies `/api/*` to the API container.

To add the demo workspace after the database is healthy, run this from a second terminal:

```bash
npm run db:seed
```

To stop the stack without deleting database data:

```bash
docker compose down
```

## Quality checks

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npx prisma validate --schema prisma/schema.prisma
docker compose config --quiet
npm run smoke:auth
npm run smoke:teams
npm run smoke:projects
npm run smoke:tasks
npm run smoke:collaboration
npm run smoke:seed
```

To apply formatting, run `npm run format`.

Run the smoke commands while the complete Docker stack is running. The lifecycle checks create unique development-only accounts and verify the real authentication, team, project, task, and collaboration flows through Nginx, the API, and PostgreSQL. Run `npm run db:seed` before `smoke:seed`.

## Demo workspace

`npm run db:seed` safely upserts a repeatable sample workspace without deleting other data. It contains five team members, one project, twelve tasks spanning every workflow status, and sample comments and activity.

Sign in with:

- Email: `admin@tarzan.local`
- Password: `TarzanDemo1!`

These credentials are for local development only. Change all credentials and `JWT_SECRET`, and set `COOKIE_SECURE=true`, before deploying to a shared or public environment.

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

## Tasks API

| Method   | Endpoint                  | Purpose                                    |
| -------- | ------------------------- | ------------------------------------------ |
| `POST`   | `/api/tasks`              | Create a task in a visible project         |
| `GET`    | `/api/tasks`              | List the current user's visible tasks      |
| `GET`    | `/api/tasks/:id`          | Get a visible task's details               |
| `PATCH`  | `/api/tasks/:id`          | Update permitted task fields               |
| `DELETE` | `/api/tasks/:id`          | Delete a task as a team admin              |
| `PATCH`  | `/api/tasks/:id/status`   | Move a permitted task through the workflow |
| `PATCH`  | `/api/tasks/:id/assignee` | Assign a team member as a team admin       |

Pass `projectId` as an optional query parameter to scope the task list. The same endpoint accepts `search`, `status`, `priority`, `type`, `assigneeId`, and `label`; search matches task keys and titles without case sensitivity, and filters can be combined. Task keys are generated atomically by PostgreSQL in the `TASK-100` format. All team members can create tasks. Team admins can update, assign, move, and delete any team task; regular members can update or move tasks they reported or are assigned to. Only members of the owning team can be assigned.

The project workspace opens in Kanban view with Backlog, Todo, In Progress, Blocked, In Review, and Done columns. Permitted users can drag task cards between columns, and each drop persists through the task status endpoint. The existing list and task-detail views remain available from the same workspace.

## Collaboration API

| Method | Endpoint                  | Purpose                                  |
| ------ | ------------------------- | ---------------------------------------- |
| `POST` | `/api/tasks/:id/comments` | Add a comment as a project team member   |
| `GET`  | `/api/tasks/:id/comments` | List a visible task's comments           |
| `GET`  | `/api/tasks/:id/activity` | List a visible task's important activity |

Comments include their author and timestamps. Task creation, field edits, workflow moves, and assignee changes create structured activity records. Task and activity writes share a database transaction, and collaboration data remains hidden from users outside the owning team.

## Database workflow

M1 introduces the `User` model, M2 adds `Team` and `TeamMember`, M3 adds `Project`, M4 adds `Task` plus its fixed enums and key sequence, and M6 adds `Comment` and `Activity`. M8 adds deterministic development fixtures without changing the schema. The API container automatically runs all checked-in migrations with `prisma migrate deploy` before it starts.

After a future schema change:

```bash
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
scripts/     End-to-end smoke verification
docker/      Production container definitions
docs/        Product requirements and technical specification
deployment/  Local, Docker, Kubernetes, Helm, and CI/CD runbooks
```

For the complete deployment learning path, start with [`deployment/README.md`](deployment/README.md).

## Current assumptions

- npm workspaces are sufficient for the initial monorepo; no additional task runner is needed yet.
- PostgreSQL 16 is the baseline database version.
- The web app uses Nginx in the production container and Vite during development.
- Self-registered users start with the global `MEMBER` role. Team administration is scoped independently through each membership.
- Authentication cookies last 24 hours and are invalidated server-side on logout.
- Team membership requires an existing registered account; invitations and email notifications remain outside the MVP.
- Project write access follows the owning team's admin role; regular team members have read-only project access.
- Regular members may update tasks they reported or are assigned to; team admins retain full task management access.
- Task creation, field edits, status changes, and assignment changes are retained as structured activity history.
- The checked-in schema represents the complete MVP data model; later schema changes should continue through named Prisma migrations.
