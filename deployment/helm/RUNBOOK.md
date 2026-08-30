# Runbook 4: deploy Tarzan with Helm

Helm packages the Kubernetes resources into one versioned chart. The templates describe resource structure, `values.yaml` supplies defaults, an environment values file supplies deployment-specific configuration, and a Helm release records what was installed.

Chart location: `deployment/helm/tarzan`.

## 1. How Helm changes the deployment model

```text
Chart.yaml + templates/*.yaml + values.yaml + environment overrides
                              |
                              v
                       helm template/install
                              |
                              v
     ConfigMap, Secret reference, PV/PVC, StatefulSet,
     Deployments, ReplicaSets, Services, Ingress, test Pod
```

The chart does not replace Kubernetes. It renders ordinary Kubernetes manifests, submits them to the API server, and tracks a release revision for upgrade and rollback.

## 2. Chart structure

```text
deployment/helm/tarzan/
  Chart.yaml                 Chart identity and version
  values.yaml                Safe reusable defaults
  values-production.yaml     Placeholder production overrides
  templates/
    _helpers.tpl              Reusable names and labels
    configmap.yaml            Non-secret runtime configuration
    secret.yaml               Optional learning Secret
    storage-class.yaml        Optional single-node lab StorageClass
    persistent-volume.yaml    Optional single-node lab PV
    persistent-volume-claim.yaml
    postgres-*.yaml           PostgreSQL Service and StatefulSet
    api-*.yaml                API Service and Deployment
    web-*.yaml                web Service and Deployment
    ingress.yaml              Optional external route and TLS
    tests/test-connection.yaml
    NOTES.txt                 Post-install help
```

Each template creates one resource kind. Named helpers are prefixed with `tarzan.` to avoid collisions with other charts.

## 3. Prerequisites on Linux

- A working Kubernetes cluster and `kubectl`
- Helm 3 or newer
- Tarzan images pushed to Harbor
- Namespace-scoped application and registry Secrets

```bash
helm version
kubectl cluster-info
kubectl create namespace tarzan --dry-run=client -o yaml | kubectl apply -f -
```

## 4. Prepare images and Secrets

Follow the image build/push section in the Kubernetes runbook. Then create Secrets:

```bash
export HARBOR_HOST=harbor.example.com

kubectl -n tarzan create secret generic tarzan-secrets \
  --from-literal=POSTGRES_PASSWORD='<DATABASE_PASSWORD>' \
  --from-literal=DATABASE_URL='postgresql://tarzan:<URL_ENCODED_PASSWORD>@postgres:5432/tarzan?schema=public' \
  --from-literal=JWT_SECRET='<JWT_SECRET_AT_LEAST_32_CHARACTERS>' \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n tarzan create secret docker-registry harbor-registry \
  --docker-server="$HARBOR_HOST" \
  --docker-username='<HARBOR_ROBOT_USERNAME>' \
  --docker-password='<HARBOR_ROBOT_TOKEN>' \
  --dry-run=client -o yaml | kubectl apply -f -
```

The default chart uses `secret.create=false`, so Helm references `tarzan-secrets` without storing secret values in a values file or Helm release.

## 5. Choose storage

### Single-node learning cluster

Prepare the Linux node path:

```bash
sudo install -d -m 0770 /var/lib/tarzan/postgres
```

Enable the chart's static learning storage:

```bash
helm template tarzan deployment/helm/tarzan \
  --namespace tarzan \
  --set postgres.persistence.static.enabled=true
```

### Production cluster

Keep static storage disabled and set the CSI StorageClass in your environment values:

```yaml
postgres:
  persistence:
    static:
      enabled: false
    storageClassName: your-csi-storage-class
    size: 20Gi
```

If `storageClassName` is empty, Kubernetes uses the cluster's default StorageClass. Use `existingClaim` to bind a pre-created PVC.

## 6. Create an environment values file

Copy the placeholder file outside the repository or into a GitOps repository:

```bash
cp deployment/helm/tarzan/values-production.yaml /tmp/tarzan-values.yaml
chmod 600 /tmp/tarzan-values.yaml
```

Replace:

- Harbor host and image repositories
- immutable image tag
- CSI StorageClass
- public host
- Ingress class/TLS Secret if different

Do not put database or JWT secrets in this file.

The web image must be built with `VITE_API_URL=/api`. Keep the Service names `api`, `web`, and `postgres` unless you also update Nginx and `DATABASE_URL`.

## 7. Validate before installing

```bash
helm lint deployment/helm/tarzan
helm lint deployment/helm/tarzan -f /tmp/tarzan-values.yaml
helm template tarzan deployment/helm/tarzan \
  --namespace tarzan \
  -f /tmp/tarzan-values.yaml > /tmp/tarzan-rendered.yaml
kubectl apply --dry-run=server -f /tmp/tarzan-rendered.yaml
```

`helm lint` checks chart structure and template logic. `helm template` lets you inspect final YAML. Server-side dry run asks the real Kubernetes API server to validate resources without persisting them.

## 8. Install or upgrade

One idempotent command handles both first installation and later updates:

```bash
helm upgrade --install tarzan deployment/helm/tarzan \
  --namespace tarzan \
  --create-namespace \
  -f /tmp/tarzan-values.yaml \
  --atomic \
  --timeout 10m
```

- `upgrade --install`: create the release if absent, otherwise update it.
- `--atomic`: roll back a failed upgrade automatically.
- `--timeout`: bounds how long Helm waits for resources.
- values file: keeps environment differences out of templates.

The API image entrypoint runs checked-in Prisma migrations before NestJS starts. Use a dedicated migration Job/release stage when the application grows to require tightly controlled database rollouts.

## 9. Verify the release

```bash
helm list -n tarzan
helm status tarzan -n tarzan
helm get values tarzan -n tarzan
helm get manifest tarzan -n tarzan > /tmp/tarzan-installed.yaml
kubectl -n tarzan get deployments,replicasets,pods,services,pvc,ingress
kubectl -n tarzan rollout status deployment/tarzan-tarzan-api
kubectl -n tarzan rollout status deployment/tarzan-tarzan-web
helm test tarzan -n tarzan --logs
```

If `fullnameOverride` changes resource names, use `kubectl get deployment -n tarzan` to find the actual names.

Without Ingress:

```bash
kubectl -n tarzan port-forward service/web 5173:80
curl --fail http://127.0.0.1:5173/api/health
```

## 10. Deploy a new image

Update both immutable tags in the environment values file, commit that change to the GitOps repository, and let Argo CD synchronize it. For a direct learning deployment:

```bash
helm upgrade tarzan deployment/helm/tarzan \
  --namespace tarzan \
  -f /tmp/tarzan-values.yaml \
  --set-string api.image.tag='<NEW_GIT_SHA>' \
  --set-string web.image.tag='<NEW_GIT_SHA>' \
  --atomic \
  --timeout 10m
```

Using `--set-string` prevents numeric-looking Git SHAs or tags from being converted to another YAML type.

## 11. History and rollback

```bash
helm history tarzan -n tarzan
helm rollback tarzan <REVISION> -n tarzan --wait --timeout 10m
```

Helm rollback restores Kubernetes resources from a release revision. It does not automatically reverse database migrations. Design database migrations to remain compatible with the previous application version or supply an explicit database rollback plan.

## 12. Secrets, configuration, and restarts

- Changes to the chart-created ConfigMap alter its checksum annotation and roll API/PostgreSQL Pods.
- Changes to a chart-created Secret also change a checksum.
- An externally managed Secret cannot be checksummed by the chart. Restart the API and PostgreSQL workloads after rotating it.

```bash
kubectl -n tarzan rollout restart deployment/tarzan-tarzan-api
kubectl -n tarzan rollout restart statefulset/tarzan-tarzan-postgres
```

Coordinate PostgreSQL password rotation with the password stored inside PostgreSQL.

## 13. Uninstall

```bash
helm uninstall tarzan -n tarzan
```

PVC/PV retention depends on the storage provider and reclaim policy. Confirm backups and inspect storage before deleting any retained PVC, PV, snapshot, or host directory.

## 14. Helm and Argo CD

In GitOps mode, Argo CD runs the equivalent template/render/apply loop. Jenkins should update only image tags in the Git repository; Argo CD observes the commit and reconciles the cluster. Avoid running `helm upgrade` from Jenkins and Argo CD against the same release because two controllers would own the same resources.

## Official references

- [Helm introduction](https://helm.sh/docs/intro/introduction/)
- [Chart template guide](https://helm.sh/docs/chart_template_guide/)
- [Chart best practices](https://helm.sh/docs/chart_best_practices/)
- [Debugging templates](https://helm.sh/docs/chart_template_guide/debugging/)
