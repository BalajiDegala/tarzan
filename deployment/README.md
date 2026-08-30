# Tarzan deployment learning path

This directory turns the same Tarzan application into a progressive deployment lab. Follow the runbooks in order; each layer keeps the application architecture the same while replacing more manual operations with platform automation.

```text
Browser
  |
  v
Web (React build served by Vite or Nginx)
  |  /api
  v
API (NestJS on port 3000)
  |
  v
PostgreSQL 16
```

## Recommended order

1. [Local without containers](local/RUNBOOK.md) — learn processes, ports, environment variables, migrations, and logs.
2. [Docker Compose](docker/RUNBOOK.md) — learn images, containers, networking, health checks, and volumes.
3. [Kubernetes](kubernetes/RUNBOOK.md) — learn declarative workloads, ReplicaSets, configuration, secrets, storage, and Services.
4. [Helm](helm/RUNBOOK.md) — learn how one parameterized chart produces the Kubernetes resources.
5. [CI/CD](cicd/RUNBOOK.md) — learn the GitLab, Jenkins, SonarQube, Harbor, and Argo CD delivery flow.

## Repository map

```text
deployment/
  local/        Native Node.js and PostgreSQL runbook
  docker/       Docker and Docker Compose runbook
  kubernetes/   Raw Kubernetes manifests and runbook
  helm/         Helm chart and runbook
  argocd/       Argo CD Application definition
  cicd/         End-to-end CI/CD runbook
Jenkinsfile     Jenkins declarative pipeline
```

The raw manifests are intentionally explicit for learning. The Helm chart represents the maintainable, parameterized form normally promoted between environments.

## Configuration ownership

| Configuration        | Local                     | Docker Compose        | Kubernetes / Helm                |
| -------------------- | ------------------------- | --------------------- | -------------------------------- |
| Database host        | `localhost`               | `db`                  | `postgres` Service               |
| API host             | `localhost:3000`          | `api:3000` internally | `api:3000` Service               |
| Browser entry        | Vite `:5173`              | Nginx `:5173`         | web Service / Ingress            |
| Non-sensitive config | `.env`                    | `.env` + Compose      | ConfigMap / Helm values          |
| Credentials          | `.env`                    | `.env`                | Secret / external secret manager |
| Database files       | PostgreSQL data directory | named Docker volume   | PVC bound to a PV                |

Never commit real passwords, JWT secrets, kubeconfigs, registry credentials, or Argo CD tokens. Files named `*.example.*` contain placeholders only.
