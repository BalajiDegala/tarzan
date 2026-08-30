# Runbook 1: run Tarzan locally without Docker Compose

This mode runs PostgreSQL as a native operating-system service and runs the API and web application as Node.js processes. It is the best place to learn what each process needs before introducing containers.

## 1. Understand the local topology

```text
http://localhost:5173  React/Vite development server
          |
          | HTTP requests to http://localhost:3000/api
          v
http://localhost:3000  NestJS API
          |
          | DATABASE_URL
          v
localhost:5432          PostgreSQL 16
```

The API validates `DATABASE_URL` and `JWT_SECRET` during startup. The web app needs `VITE_API_URL` at build/start time. `WEB_ORIGIN` allows the browser origin to send authenticated cross-origin requests to the API.

## 2. Prerequisites

- Node.js 22.12 or newer
- npm 10 or newer
- PostgreSQL 16 with the `psql` client
- Git

Verify them:

On Ubuntu/Debian, install Node.js 22 from your approved Node.js repository and PostgreSQL 16 from the PostgreSQL Apt repository, then verify:

```bash
node --version
npm --version
psql --version
git --version
```

## 3. Create the PostgreSQL user and database

Open `psql` as your local PostgreSQL administrator:

```bash
sudo -u postgres psql
```

Run these SQL statements. Change the password if the machine is shared:

```sql
CREATE ROLE tarzan WITH LOGIN PASSWORD 'tarzan_local_password';
CREATE DATABASE tarzan OWNER tarzan;
\q
```

If the role or database already exists, do not recreate it. Confirm connectivity instead:

```bash
psql "postgresql://tarzan:tarzan_local_password@localhost:5432/tarzan" -c "select current_database(), current_user;"
```

## 4. Configure the application

From the repository root:

```bash
cp .env.example .env
```

For native PostgreSQL on its default port, the important values are:

```dotenv
POSTGRES_PORT=5432
DATABASE_URL=postgresql://tarzan:tarzan_local_password@localhost:5432/tarzan?schema=public
API_PORT=3000
WEB_PORT=5173
VITE_API_URL=http://localhost:3000/api
WEB_ORIGIN=http://localhost:5173
JWT_SECRET=replace_with_a_random_secret_of_at_least_32_characters
COOKIE_SECURE=false
```

Generate a development JWT secret with OpenSSL:

```bash
openssl rand -base64 48
```

`COOKIE_SECURE=false` is required for plain local HTTP. Use `true` only behind HTTPS.

## 5. Install, migrate, and seed

```bash
npm ci
npm run prisma:generate
npm run prisma:migrate:deploy
npm run db:seed
```

What each command does:

| Command                 | Purpose                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| `npm ci`                | Installs the exact dependency versions from `package-lock.json`. |
| `prisma:generate`       | Generates the Prisma client used by the API and seed script.     |
| `prisma:migrate:deploy` | Applies checked-in SQL migrations in order.                      |
| `db:seed`               | Idempotently creates the learning workspace and demo users.      |

The seed is safe to rerun and does not delete unrelated records.

## 6. Start the application

The simplest development command starts both processes:

```bash
npm run dev
```

The root script first builds shared packages, then starts:

- NestJS watch mode on `http://localhost:3000`
- Vite watch mode on `http://localhost:5173`

To understand the processes separately, use two terminals after `npm run build:packages`:

```bash
# Terminal 1
npm run dev --workspace @tarzan/api
```

```bash
# Terminal 2
npm run dev --workspace @tarzan/web
```

## 7. Verify the deployment

```bash
curl --fail http://localhost:3000/api/health
xdg-open http://localhost:5173 >/dev/null 2>&1 &
```

Expected health response:

```json
{ "name": "tarzan-api", "status": "ok", "version": "0.1.0" }
```

Demo login:

- Email: `admin@tarzan.local`
- Password: `TarzanDemo1!`

The main routes are `/teams`, `/projects`, and `/board`.

## 8. Run quality and smoke checks

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run smoke:auth
npm run smoke:teams
npm run smoke:projects
npm run smoke:tasks
npm run smoke:collaboration
npm run smoke:seed
```

The smoke scripts default to `http://127.0.0.1:5173/api`. Vite does not proxy `/api` in development, so for a fully native development run set the API base explicitly:

```bash
SMOKE_BASE_URL=http://127.0.0.1:3000/api npm run smoke:seed
```

## 9. Preview production builds without containers

Build everything:

```bash
npm run build
```

Start the compiled API:

```bash
npm run start --workspace @tarzan/api
```

In another terminal, preview the static web build:

```bash
npm run preview --workspace @tarzan/web -- --host 0.0.0.0 --port 5173
```

Vite preview is suitable for local verification, not as an internet-facing production web server. The Docker deployment uses Nginx for that role.

## 10. Stop and restart

- Press `Ctrl+C` in each Node.js terminal.
- PostgreSQL may remain running as an operating-system service.
- Restarting Node does not remove database data.
- Run migrations again after pulling a commit that adds a migration.

## Troubleshooting

### Prisma cannot reach PostgreSQL (`P1001`)

Check the PostgreSQL service, port, credentials, and database:

```bash
sudo systemctl status postgresql
pg_isready -h localhost -p 5432 -U tarzan
psql "$DATABASE_URL" -c "select 1;"
```

### Port 5432, 3000, or 5173 is already used

```bash
sudo ss -ltnp
```

Change the corresponding `.env` value. Keep `DATABASE_URL`, `VITE_API_URL`, and `WEB_ORIGIN` consistent with the new ports.

### Browser login succeeds but the session disappears

Confirm that:

- the browser uses the exact origin in `WEB_ORIGIN`;
- `COOKIE_SECURE=false` for HTTP;
- the API is reached through the URL in `VITE_API_URL`;
- the system clock is correct, because JWT expiry depends on it.

### Migration failed

Inspect status before changing the database manually:

```bash
npx prisma migrate status --schema prisma/schema.prisma
```

Do not edit a migration that has already been applied. Add a new migration for schema changes.
