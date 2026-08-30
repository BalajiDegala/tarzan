# Argo CD runbook for Tarzan

Argo CD continuously compares the desired state in Git with the live Kubernetes cluster. For Tarzan, it renders the Helm chart from the application repository with production values from a separate GitOps repository.

All commands in this runbook are for a Linux shell.

## 1. Desired-state flow

```text
Application repository                    GitOps repository
deployment/helm/tarzan                    environments/production/
        |                                 tarzan-values.yaml
        +-------------------+----------------------+
                            |
                            v
                    Argo CD Application
                            |
                       helm template
                            |
                            v
                      Kubernetes API
```

The separate GitOps repository is intentional. Jenkins can update an image tag without creating another application-build webhook loop, and deployment history remains a small, readable list of environment changes.

### Current repository plan: GitHub now, GitLab later

The Tarzan application repository is currently hosted on GitHub. The checked-in Argo CD manifests intentionally keep example GitLab URLs because GitLab will become the final CI/CD source later. There is no need to change those placeholders until Argo CD is actually being configured.

When the GitLab deployment stage begins, maintain two GitLab repositories:

```text
tarzan          application source, Dockerfiles, Helm chart, and Jenkinsfile
tarzan-gitops   environment values consumed by Argo CD
```

The GitOps repository needs only this deployment file initially:

```text
tarzan-gitops/
  environments/
    production/
      tarzan-values.yaml
```

Create it by copying `deployment/argocd/gitops-values.example.yaml`. If Argo CD is needed while the application remains on GitHub, the same two-repository model can be used on GitHub; Argo CD can also read the chart from GitHub and values from GitLab. The two repositories do not have to use the same Git provider.

After the repositories are available in GitLab, update:

1. `application.yaml`: both `repoURL` fields and both `targetRevision` branches.
2. `app-project.yaml`: both entries under `sourceRepos`.
3. the root `Jenkinsfile`: `APPLICATION_REPOSITORY`, `GITOPS_REPOSITORY`, `DEPLOY_BRANCH`, and `GITOPS_BRANCH`.
4. Jenkins checkout/deploy credentials and Argo CD read-only repository credentials.

Use the real default branch name, such as `main`, consistently. Do not copy GitHub or GitLab access tokens into these files.

## 2. Files in this directory

- `app-project.yaml`: limits the repositories and cluster destination the Application may use.
- `application.yaml`: joins the Helm chart and external values, then enables automated synchronization.
- `gitops-values.example.yaml`: starting file for the separate GitOps repository.

The manifests contain placeholder GitLab, Harbor, DNS, and StorageClass values. Replace them before applying.

## 3. Prerequisites

- A Linux Kubernetes cluster with an Ingress controller and CSI StorageClass
- Argo CD installed in namespace `argocd`
- `kubectl`, `argocd`, `git`, and `helm` on the administration machine
- SSH deploy keys that can read both source repositories on GitHub or GitLab
- Tarzan API and web images already present in Harbor

```bash
kubectl -n argocd get deployments,pods,services
argocd version --client
helm version
```

## 4. Bootstrap the GitOps repository

When GitLab is ready, create a separate repository such as `platform/tarzan-gitops`, then on Linux:

```bash
git clone ssh://git@gitlab.example.com/platform/tarzan-gitops.git
cd tarzan-gitops
mkdir -p environments/production
cp /path/to/tarzan/deployment/argocd/gitops-values.example.yaml \
  environments/production/tarzan-values.yaml
```

Edit the copied file and replace the Harbor host, initial image tag, DNS name, TLS Secret, and CSI StorageClass. Do not add database passwords, JWT secrets, registry tokens, or kubeconfigs.

```bash
git add environments/production/tarzan-values.yaml
git commit -m 'chore: bootstrap Tarzan production values'
git push origin master
```

Protect the GitOps `master` branch. Grant the Jenkins deploy key permission to update only this repository and require review if your promotion process needs approval.

## 5. Register the repositories in Argo CD

Use a read-only GitLab deploy key. The private-key file must be mode `0600` and kept outside Git:

```bash
chmod 600 /secure/path/argocd-gitlab-readonly
argocd login argocd.example.com

argocd repo add ssh://git@gitlab.example.com/platform/tarzan.git \
  --ssh-private-key-path /secure/path/argocd-gitlab-readonly

argocd repo add ssh://git@gitlab.example.com/platform/tarzan-gitops.git \
  --ssh-private-key-path /secure/path/argocd-gitlab-readonly

argocd repo list
```

If GitLab uses a private SSH host key or CA, add that trust to Argo CD instead of disabling host verification.

## 6. Create runtime Secrets first

Argo CD does not own plaintext application credentials in this setup. Create them with your external secret manager, Sealed Secrets, or manually for the learning lab:

```bash
kubectl create namespace tarzan --dry-run=client -o yaml | kubectl apply -f -

kubectl -n tarzan create secret generic tarzan-secrets \
  --from-literal=POSTGRES_PASSWORD='<DATABASE_PASSWORD>' \
  --from-literal=DATABASE_URL='postgresql://tarzan:<URL_ENCODED_PASSWORD>@postgres:5432/tarzan?schema=public' \
  --from-literal=JWT_SECRET='<JWT_SECRET_AT_LEAST_32_CHARACTERS>' \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n tarzan create secret docker-registry harbor-registry \
  --docker-server='harbor.example.com' \
  --docker-username='<HARBOR_PULL_ROBOT>' \
  --docker-password='<HARBOR_PULL_TOKEN>' \
  --dry-run=client -o yaml | kubectl apply -f -
```

Create the Ingress TLS Secret through cert-manager or your approved certificate process.

## 7. Configure and apply the Argo CD resources

Replace every `gitlab.example.com`, repository path, branch, and environment-specific value in `app-project.yaml` and `application.yaml`. Validate the local files:

```bash
kubectl apply --dry-run=server -f deployment/argocd/app-project.yaml
kubectl apply --dry-run=server -f deployment/argocd/application.yaml
```

Then create them:

```bash
kubectl apply -f deployment/argocd/app-project.yaml
kubectl apply -f deployment/argocd/application.yaml
```

The custom AppProject permits namespaced resources in `tarzan`, plus Namespace, PV, and StorageClass resources required by the learning chart. Production normally uses dynamic CSI provisioning, so the chart renders only a PVC and no static PV or StorageClass.

## 8. Watch the first synchronization

```bash
argocd app get tarzan --refresh
argocd app wait tarzan --sync --health --timeout 600
kubectl -n tarzan get deployments,replicasets,statefulsets,pods,services,pvc,ingress
kubectl -n tarzan get events --sort-by=.metadata.creationTimestamp
```

With automated sync enabled:

- a Git commit changes the desired state;
- Argo CD renders both sources and applies the difference;
- `prune` removes resources deleted from Git;
- `selfHeal` reverses unapproved manual drift in the cluster;
- retry handles transient synchronization failures.

## 9. Normal deployment

Jenkins builds images tagged with the application Git commit SHA and updates only these four values in the GitOps repository:

```yaml
api.image.repository: harbor.example.com/tarzan/tarzan-api
api.image.tag: <GIT_SHA>
web.image.repository: harbor.example.com/tarzan/tarzan-web
web.image.tag: <GIT_SHA>
```

Argo CD detects that GitOps commit and performs the Kubernetes rollout. Jenkins does not run `kubectl apply` or `helm upgrade`, so there is one deployment owner.

## 10. Roll back safely

Because automated sync is enabled, roll back by reverting the GitOps commit:

```bash
cd tarzan-gitops
git log --oneline -- environments/production/tarzan-values.yaml
git revert <BAD_GITOPS_COMMIT>
git push origin master
argocd app wait tarzan --sync --health --timeout 600
```

This restores both images to the previous immutable tags. It does not reverse database migrations; migrations must remain backward compatible or have a separate rollback procedure.

## 11. Common failures

| Symptom                | Check                         | Resolution                                                                      |
| ---------------------- | ----------------------------- | ------------------------------------------------------------------------------- |
| `ComparisonError`      | `argocd app get tarzan`       | Verify both repository URLs, branches, SSH access, and `$values` file path.     |
| `ImagePullBackOff`     | Pod events                    | Confirm Harbor image/tag, registry CA trust, and `harbor-registry`.             |
| PVC is `Pending`       | PVC events and StorageClasses | Correct `postgres.persistence.storageClassName` or install the CSI provisioner. |
| Pods wait for Secret   | Pod events                    | Create `tarzan-secrets` with all required keys.                                 |
| Ingress has no address | Ingress controller Pods       | Install/configure the controller and DNS.                                       |
| App stays `OutOfSync`  | resource diff in Argo UI      | Find the mutating controller or bad Helm value; avoid manual edits.             |

## 12. Security and ownership

- Argo CD Git credentials are read-only; Jenkins has write access only to GitOps values.
- Harbor uses separate push and pull robot accounts.
- Kubernetes Secrets are supplied outside the chart.
- The Application manifest deliberately has no deletion finalizer, reducing the chance that deleting only the Application object also cascades into workload deletion. Define a reviewed decommission procedure before deleting application resources.

## Official references

- [Argo CD multiple sources](https://argo-cd.readthedocs.io/en/stable/user-guide/multiple_sources/)
- [Argo CD automated sync](https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/)
- [Argo CD declarative setup](https://argo-cd.readthedocs.io/en/stable/operator-manual/declarative-setup/)
