# CI/CD runbook: GitLab to Jenkins to Harbor to Argo CD

This runbook connects the complete delivery path on Linux. GitLab notifies Jenkins, Jenkins verifies and packages the commit, SonarQube enforces a quality gate, Harbor stores immutable images, Jenkins records the new tags in GitOps, and Argo CD reconciles Kubernetes.

## 1. End-to-end flow

```text
Developer push / merge request
             |
             v
       GitLab webhook
             |
             v
       Jenkinsfile on Linux
       |  npm ci, lint, typecheck, test, build
       |  SonarQube analysis + quality gate
       |  Docker build (master push only)
       v
      Harbor: tarzan-api:<git-sha>, tarzan-web:<git-sha>
             |
             v
   Jenkins commits tags to separate GitOps repository
             |
             v
      Argo CD automated sync
             |
             v
       Kubernetes rollout
```

Merge requests and feature branches stop after validation and SonarQube. A non-merge-request build of `master` may publish and deploy.

## 2. Replace the placeholders

Before using `Jenkinsfile`, replace these values:

| Placeholder                       | Example location              | Meaning                                 |
| --------------------------------- | ----------------------------- | --------------------------------------- |
| `master`                          | `DEPLOY_BRANCH`, Argo sources | protected deployment branch             |
| `harbor.example.com`              | Jenkins, Helm/GitOps values   | Harbor registry DNS name                |
| `gitlab.example.com/platform/...` | Jenkins and Argo CD           | application and GitOps repositories     |
| `argocd.example.com`              | Jenkins                       | Argo CD API/Ingress address             |
| `linux-docker`                    | Jenkins `agent`               | label on the isolated Linux build agent |
| DNS and StorageClass placeholders | GitOps values                 | target cluster configuration            |

Keep the credential IDs unchanged or update both Jenkins and the table below.

## 3. Prepare the Linux Jenkins agent

Use a dedicated, ephemeral agent where possible. It requires:

- Node.js 22 and npm 10
- Git and OpenSSH client
- Docker Engine/CLI with BuildKit
- `yq` v4
- the Argo CD CLI only when `FORCE_ARGOCD_SYNC` is used
- network and CA trust for GitLab, SonarQube, Harbor, and optionally Argo CD

Verify while logged in as the Jenkins agent user:

```bash
node --version
npm --version
git --version
docker version
yq --version
docker buildx version
```

Do not casually mount a production host Docker socket or add a broadly trusted Jenkins user to the `docker` group: Docker control is effectively root-level access. Use a dedicated build VM, rootless builder, or an approved Kubernetes build system.

For a Harbor installation using a private CA, install the CA according to your Linux distribution and Docker configuration. A common Docker Engine location is:

```text
/etc/docker/certs.d/harbor.example.com/ca.crt
```

Restart Docker after changing its trust configuration. Do not set Harbor as an insecure registry in production.

## 4. Install and configure Jenkins plugins

Install current compatible versions of:

- Pipeline and Pipeline: Declarative
- Git and GitLab plugins
- Credentials Binding
- SSH Agent
- SonarQube Scanner for Jenkins
- Timestamper

In **Manage Jenkins > Tools**, add a SonarQube Scanner installation named `SonarScanner`.

In **Manage Jenkins > System > SonarQube servers**, add the server as `sonarqube`, select its token credential, and enable environment injection. In SonarQube, add a webhook ending exactly in:

```text
https://jenkins.example.com/sonarqube-webhook/
```

The trailing slash is required by the Jenkins integration. The webhook lets `waitForQualityGate` resume without wasteful polling.

## 5. Add Jenkins credentials

Store credentials in Jenkins, never in the repository:

| Jenkins credential ID                          | Type                          | Minimum privilege                                |
| ---------------------------------------------- | ----------------------------- | ------------------------------------------------ |
| `gitlab-app-read`                              | SSH username with private key | read application repository                      |
| `harbor-robot-push`                            | username/password             | push and pull only in Harbor project `tarzan`    |
| `gitlab-gitops-ssh`                            | SSH username with private key | write only the GitOps repository                 |
| SonarQube token selected on server `sonarqube` | secret text                   | execute analysis for project `tarzan`            |
| `argocd-jenkins-token`                         | secret text                   | optional sync/get access to Application `tarzan` |

The optional Argo CD credential is not needed for the normal automated-sync path. Omitting it reduces Jenkins access to the cluster delivery plane.

## 6. Prepare Harbor

Create a private Harbor project named `tarzan`. Create:

1. a CI robot account that can push/pull repository artifacts in that project;
2. a separate runtime robot account with pull-only access for Kubernetes.

Add the CI robot to Jenkins as `harbor-robot-push`. Use the pull robot to create `harbor-registry` in namespace `tarzan`, as shown in the Kubernetes and Argo CD runbooks.

The pipeline creates two repositories on first push:

```text
harbor.example.com/tarzan/tarzan-api:<12-character-git-sha>
harbor.example.com/tarzan/tarzan-web:<12-character-git-sha>
```

Use immutable tag rules for release repositories. Enable Harbor vulnerability scanning and define a retention policy that preserves deployed and rollback tags.

## 7. Prepare SonarQube

The checked-in `sonar-project.properties` indexes application, shared package, Prisma, and script sources, while classifying `*.spec.ts` and `*.test.ts` as tests.

Create or allow automatic creation of project key `tarzan`, then set a quality gate appropriate for the learning environment. The current test command does not generate LCOV coverage, so the configuration intentionally does not claim a coverage report. Add a Vitest coverage provider and LCOV path later if coverage is made a gate.

SonarQube branch and merge-request analysis requires an edition/configuration that supports it. With an edition limited to the main branch, restrict the Jenkins SonarQube stages to `master` or run a separate main-branch analysis job.

## 8. Create the Jenkins job and GitLab trigger

Create a Jenkins Pipeline job named `tarzan`:

1. choose **Pipeline script from SCM**;
2. select Git and enter the Tarzan application repository;
3. select `gitlab-app-read` as the checkout credential;
4. set the Jenkinsfile branch specifier to the protected `master` branch;
5. keep script path `Jenkinsfile`.

The trusted Jenkinsfile is therefore loaded from `master`. Its Checkout stage then uses GitLab's `gitlabSourceBranch` webhook variable to check out the source branch being validated. A manual run uses `MANUAL_SOURCE_BRANCH`. This avoids accidentally testing `master` when a feature-branch webhook arrives and prevents a merge request from replacing the pipeline definition before trusted credentials are considered.

Configure the Jenkins GitLab plugin connection under **Manage Jenkins > System**, test it, and enable authentication for the `/project` endpoint.

In the job's GitLab trigger advanced settings, generate a Secret Token. In GitLab open **Settings > Webhooks** and configure:

```text
URL:          https://jenkins.example.com/project/tarzan
Secret token: <TOKEN_GENERATED_BY_JENKINS>
Events:       Push events and merge request events
SSL verify:   enabled
```

Use GitLab's webhook test and confirm Jenkins records the cause. Do not put the webhook token in `Jenkinsfile`.

## 9. Bootstrap GitOps and Argo CD

Follow `deployment/argocd/RUNBOOK.md` to:

1. create `tarzan-gitops`;
2. add `environments/production/tarzan-values.yaml`;
3. register both Git repositories with Argo CD;
4. create runtime Secrets;
5. apply `app-project.yaml` and `application.yaml`.

The Jenkins SSH key must have `known_hosts` trust for GitLab on the Linux agent. Populate it through the machine image or configuration management; do not use `StrictHostKeyChecking=no`.

## 10. What each Jenkins stage does

| Stage                | Purpose                                         | Runs on merge requests? | Runs on deployment branch push? |
| -------------------- | ----------------------------------------------- | ----------------------: | ------------------------------: |
| Checkout             | Calculates Git SHA and release eligibility      |                     yes |                             yes |
| Agent prerequisites  | Fails early if Linux tools are missing          |                     yes |                             yes |
| Install dependencies | Reproducible `npm ci` from lockfile             |                     yes |                             yes |
| Quality checks       | format, lint, typecheck, unit tests, build      |                     yes |                             yes |
| SonarQube + gate     | static analysis and policy decision             |                     yes |                             yes |
| Build images         | creates API and Nginx web images                |                      no |                             yes |
| Push images          | authenticates to Harbor without echoing token   |                      no |                             yes |
| Update GitOps        | commits both immutable image tags               |                      no |                             yes |
| Optional Argo sync   | requests and waits for immediate reconciliation |                      no |                  parameter only |

The web build always receives `VITE_API_URL=/api`; Nginx proxies that path to the Kubernetes Service named `api`.

## 11. First pipeline test

First create a feature branch and merge request. Confirm that quality and SonarQube run but no image is pushed. Then merge to the protected deployment branch and watch:

```bash
# Harbor artifacts
docker pull harbor.example.com/tarzan/tarzan-api:<GIT_SHA>
docker pull harbor.example.com/tarzan/tarzan-web:<GIT_SHA>

# GitOps and Argo CD
argocd app get tarzan --refresh
argocd app wait tarzan --sync --health --timeout 600

# Kubernetes
kubectl -n tarzan rollout status deployment/tarzan-tarzan-api
kubectl -n tarzan rollout status deployment/tarzan-tarzan-web
kubectl -n tarzan get pods,services,ingress
```

## 12. Failure boundaries

- A quality command or SonarQube gate failure stops before credentials and image publishing.
- An image push failure leaves GitOps unchanged, so Kubernetes remains on the previous version.
- A GitOps push failure leaves new images unused but safe in Harbor; rerun after fixing Git access.
- An Argo CD sync failure keeps the desired commit visible and reports the exact resource that failed.
- `--atomic` is not involved in the GitOps path; Kubernetes rolling updates plus Argo health determine success.

## 13. Rollback and recovery

Revert the bad GitOps commit; do not rebuild an old Git SHA under a new tag:

```bash
git clone ssh://git@gitlab.example.com/platform/tarzan-gitops.git
cd tarzan-gitops
git log --oneline -- environments/production/tarzan-values.yaml
git revert <BAD_GITOPS_COMMIT>
git push origin master
argocd app wait tarzan --sync --health --timeout 600
```

If a pipeline is interrupted after Harbor push but before GitOps commit, simply rerun the same application commit. The immutable tag and values update are idempotent.

## 14. Troubleshooting

| Failure                      | Evidence                                       | Typical fix                                                           |
| ---------------------------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| GitLab returns webhook error | GitLab webhook delivery and Jenkins system log | correct `/project/<JOB>`, plugin connection, token, DNS, or TLS trust |
| `docker: permission denied`  | Jenkins console and socket ownership           | use a correctly provisioned isolated build agent/builder              |
| Harbor `x509` error          | Docker daemon log                              | install Harbor CA for the Docker daemon                               |
| Sonar gate waits forever     | SonarQube webhook delivery                     | correct the Jenkins webhook URL and secret                            |
| `yq` expression fails        | `yq --version`                                 | install Mike Farah `yq` v4, not the unrelated Python wrapper          |
| GitOps SSH fails             | `ssh -T git@gitlab.example.com` as agent user  | install known host and correct scoped deploy key                      |
| Argo comparison fails        | `argocd app get tarzan`                        | fix repository access, branch, chart, or external values path         |

## 15. Production hardening checklist

- Run untrusted merge-request validation without Harbor, GitOps, or Argo credentials.
- Protect `master` and require successful Jenkins status before merge.
- Keep Jenkins agents ephemeral and credentials narrowly scoped.
- Generate SBOMs, scan images, sign them, and enforce admission policy.
- Back up PostgreSQL independently from the PVC.
- Use an external secret manager and automated certificate management.
- Pin and regularly patch Jenkins plugins, build images, Helm, and Argo CD.
- Add deployment notifications and audit retention.

## Official references

- [Jenkins Pipeline syntax](https://www.jenkins.io/doc/book/pipeline/syntax/)
- [Jenkins credential handling](https://www.jenkins.io/doc/book/using/using-credentials/)
- [GitLab Jenkins integration and webhooks](https://docs.gitlab.com/integration/jenkins/)
- [SonarQube Jenkins quality gate](https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/ci-integration/jenkins-integration/pipeline-pause/)
- [Harbor projects and images](https://goharbor.io/docs/main/working-with-projects/)
- [Argo CD automated sync](https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/)
