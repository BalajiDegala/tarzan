# Runbook 3: deploy Tarzan with raw Kubernetes manifests

This runbook targets a Linux Kubernetes environment. A single-node cluster is sufficient for learning; production needs a real CSI storage provider, TLS, backups, monitoring, and a highly available database.

## 1. Architecture

```text
Client
  |
  v
Ingress (optional for local learning)
  |
  v
web Service :80
  |
  +--> web Deployment --> ReplicaSet --> 2 Nginx Pods
                                  |
                                  | proxy /api to api:3000
                                  v
api Service :3000
  |
  +--> api Deployment --> ReplicaSet --> 2 NestJS Pods
                                  |
                                  v
postgres headless Service :5432
  |
  +--> PostgreSQL StatefulSet --> PVC --> PV --> Linux node storage
```

Kubernetes Services provide stable DNS names while Pods and their IP addresses change. The existing Nginx configuration already proxies to `api:3000`, and the API uses the Secret's `DATABASE_URL` with host `postgres`.

## 2. What every resource teaches

| File                              | Kind                  | Responsibility                                                              |
| --------------------------------- | --------------------- | --------------------------------------------------------------------------- |
| `00-namespace.yaml`               | Namespace             | Isolates all namespaced Tarzan resources.                                   |
| `01-configmap.yaml`               | ConfigMap             | Stores non-confidential runtime configuration.                              |
| `02-secret.example.yaml`          | Secret template       | Documents required confidential values without committing real credentials. |
| `03-storage-class.yaml`           | StorageClass          | Defines a static, no-provisioner class for a single-node Linux lab.         |
| `04-persistent-volume.yaml`       | PersistentVolume      | Represents 10 GiB of node storage independent of a Pod.                     |
| `05-persistent-volume-claim.yaml` | PersistentVolumeClaim | Requests storage for PostgreSQL and binds to the matching PV.               |
| `06-postgres-service.yaml`        | Headless Service      | Gives the StatefulSet stable DNS name `postgres`.                           |
| `07-postgres-statefulset.yaml`    | StatefulSet           | Runs one ordered, stateful PostgreSQL Pod using the PVC.                    |
| `08-api-service.yaml`             | ClusterIP Service     | Load-balances internal traffic across ready API Pods.                       |
| `09-api-deployment.yaml`          | Deployment            | Declares two stateless API replicas and rolling-update behavior.            |
| `10-web-service.yaml`             | ClusterIP Service     | Provides the stable frontend endpoint.                                      |
| `11-web-deployment.yaml`          | Deployment            | Declares two stateless Nginx replicas.                                      |
| `12-ingress.yaml`                 | Ingress               | Optionally routes external HTTP traffic to the web Service.                 |

### Why there is no handwritten ReplicaSet

A Deployment creates and owns ReplicaSets. During a rollout, it creates a new ReplicaSet, gradually scales it up, and scales the old ReplicaSet down. Manually creating another ReplicaSet would bypass rollout history and fight the Deployment controller.

Inspect this relationship after deployment:

```bash
kubectl -n tarzan get deployments,replicasets,pods
kubectl -n tarzan describe deployment api
```

### ConfigMap versus Secret

- ConfigMap: ports, usernames, origins, feature settings, and other non-secret text.
- Secret: database passwords, complete database URLs containing credentials, JWT keys, registry credentials, and TLS private keys.

Kubernetes Secrets are not automatically a complete secret-management system. Enable encryption at rest and strict RBAC, or integrate an external manager such as Vault or a cloud secret manager in production.

### PV, PVC, and StorageClass

- PV: storage capacity supplied by the cluster administrator or a dynamic provisioner.
- PVC: the application's request for storage.
- StorageClass: the policy/provisioner used to satisfy a claim.

The checked-in `hostPath` PV is deliberately limited to a single-node lab. On a production cluster, use the platform's CSI StorageClass and let the PVC dynamically provision the PV.

## 3. Prerequisites

- A Linux Kubernetes cluster and working `kubectl`
- Kubernetes DNS/network plugin
- Nginx Ingress Controller only if using the Ingress manifest
- Docker or BuildKit to build images
- Access to Harbor or another OCI registry

```bash
kubectl version --client
kubectl cluster-info
kubectl get nodes -o wide
kubectl get storageclass
```

Use a supported Kubernetes version and keep `kubectl` within the supported version skew for the cluster.

## 4. Build and push immutable images

Set values for your environment:

```bash
export HARBOR_HOST=harbor.example.com
export HARBOR_PROJECT=tarzan
export IMAGE_TAG="$(git rev-parse --short=12 HEAD)"
```

Build and push:

```bash
docker login "$HARBOR_HOST"
docker build -f docker/api.Dockerfile -t "$HARBOR_HOST/$HARBOR_PROJECT/tarzan-api:$IMAGE_TAG" .
docker build -f docker/web.Dockerfile --build-arg VITE_API_URL=/api -t "$HARBOR_HOST/$HARBOR_PROJECT/tarzan-web:$IMAGE_TAG" .
docker push "$HARBOR_HOST/$HARBOR_PROJECT/tarzan-api:$IMAGE_TAG"
docker push "$HARBOR_HOST/$HARBOR_PROJECT/tarzan-web:$IMAGE_TAG"
```

Use the same immutable tag for both images so one Git revision maps to one deployment.

## 5. Customize the manifests

Replace image placeholders in `09-api-deployment.yaml` and `11-web-deployment.yaml`:

```text
harbor.example.com/tarzan/tarzan-api:REPLACE_WITH_TAG
harbor.example.com/tarzan/tarzan-web:REPLACE_WITH_TAG
```

Set `WEB_ORIGIN` in `01-configmap.yaml` to the browser-facing origin. Examples:

- port-forward learning: `http://localhost:5173`
- HTTP lab Ingress: `http://tarzan.example.com`
- production: `https://tarzan.company.example`

For HTTPS, set `COOKIE_SECURE: "true"`, add TLS configuration to the Ingress, and create the referenced TLS Secret.

### Choose storage mode

For a single-node lab, keep files `03`, `04`, and `05`, then prepare the node directory:

```bash
sudo install -d -m 0770 /var/lib/tarzan/postgres
```

For production dynamic storage:

1. Do not apply `03-storage-class.yaml` or `04-persistent-volume.yaml`.
2. Change `storageClassName` in `05-persistent-volume-claim.yaml` to the cluster's CSI StorageClass.
3. Keep `ReadWriteOnce` unless the database/storage documentation requires otherwise.
4. Configure volume snapshots and tested PostgreSQL backups; a PV is persistence, not a backup.

## 6. Create secrets without committing them

Create the namespace first:

```bash
kubectl apply -f deployment/kubernetes/00-namespace.yaml
```

Generate strong values:

```bash
openssl rand -base64 36
openssl rand -base64 48
```

Create the application Secret. Use a URL-encoded database password inside `DATABASE_URL`:

```bash
kubectl -n tarzan create secret generic tarzan-secrets \
  --from-literal=POSTGRES_PASSWORD='<DATABASE_PASSWORD>' \
  --from-literal=DATABASE_URL='postgresql://tarzan:<URL_ENCODED_PASSWORD>@postgres:5432/tarzan?schema=public' \
  --from-literal=JWT_SECRET='<JWT_SECRET_AT_LEAST_32_CHARACTERS>' \
  --dry-run=client -o yaml | kubectl apply -f -
```

Create the Harbor pull Secret:

```bash
kubectl -n tarzan create secret docker-registry harbor-registry \
  --docker-server="$HARBOR_HOST" \
  --docker-username='<HARBOR_ROBOT_USERNAME>' \
  --docker-password='<HARBOR_ROBOT_TOKEN>' \
  --dry-run=client -o yaml | kubectl apply -f -
```

Use a Harbor robot account with pull-only permission for the cluster. Jenkins uses a separate push-capable credential.

## 7. Apply in dependency order

Apply configuration and storage:

```bash
kubectl apply -f deployment/kubernetes/01-configmap.yaml
kubectl apply -f deployment/kubernetes/03-storage-class.yaml
kubectl apply -f deployment/kubernetes/04-persistent-volume.yaml
kubectl apply -f deployment/kubernetes/05-persistent-volume-claim.yaml
```

Start PostgreSQL and wait for readiness:

```bash
kubectl apply -f deployment/kubernetes/06-postgres-service.yaml
kubectl apply -f deployment/kubernetes/07-postgres-statefulset.yaml
kubectl -n tarzan rollout status statefulset/postgres --timeout=180s
kubectl -n tarzan get pvc,pv
```

Deploy Services and stateless workloads:

```bash
kubectl apply -f deployment/kubernetes/08-api-service.yaml
kubectl apply -f deployment/kubernetes/09-api-deployment.yaml
kubectl apply -f deployment/kubernetes/10-web-service.yaml
kubectl apply -f deployment/kubernetes/11-web-deployment.yaml
kubectl -n tarzan rollout status deployment/api --timeout=300s
kubectl -n tarzan rollout status deployment/web --timeout=300s
```

Each API container executes `prisma migrate deploy` before starting NestJS. The command applies only pending checked-in migrations. For a larger production estate, move this into one controlled migration Job or release stage instead of running it in every API replica.

Apply Ingress only when an Ingress Controller exists:

```bash
kubectl apply -f deployment/kubernetes/12-ingress.yaml
kubectl -n tarzan get ingress
```

The `kustomization.yaml` is useful after all placeholders and Secrets are prepared:

```bash
kubectl apply -k deployment/kubernetes
```

## 8. Verify every layer

```bash
kubectl -n tarzan get all
kubectl -n tarzan get configmap,secret,pvc,ingress
kubectl get pv,storageclass
kubectl -n tarzan get endpointslices
```

Check database readiness and migrations:

```bash
kubectl -n tarzan logs statefulset/postgres --tail=100
kubectl -n tarzan logs deployment/api --tail=200
```

Use port-forwarding even without Ingress:

```bash
kubectl -n tarzan port-forward service/web 5173:80
```

In another shell:

```bash
curl --fail http://127.0.0.1:5173/api/health
SMOKE_BASE_URL=http://127.0.0.1:5173/api npm run smoke:seed
```

Seed the learning workspace by running the seed in an API Pod:

```bash
API_POD="$(kubectl -n tarzan get pod -l app.kubernetes.io/name=api -o jsonpath='{.items[0].metadata.name}')"
kubectl -n tarzan exec "$API_POD" -- node prisma/seed.mjs
```

## 9. Understand rollout, ReplicaSets, scaling, and rollback

See the active image and rollout history:

```bash
kubectl -n tarzan get deployment api -o wide
kubectl -n tarzan get replicaset -l app.kubernetes.io/name=api
kubectl -n tarzan rollout history deployment/api
```

Deploy another immutable image:

```bash
kubectl -n tarzan set image deployment/api api="$HARBOR_HOST/$HARBOR_PROJECT/tarzan-api:<NEW_TAG>"
kubectl -n tarzan set image deployment/web web="$HARBOR_HOST/$HARBOR_PROJECT/tarzan-web:<NEW_TAG>"
kubectl -n tarzan rollout status deployment/api
kubectl -n tarzan rollout status deployment/web
```

Scale stateless tiers:

```bash
kubectl -n tarzan scale deployment/api --replicas=3
kubectl -n tarzan scale deployment/web --replicas=3
```

Do not scale the included PostgreSQL StatefulSet above one replica. PostgreSQL replication requires database-aware configuration, not just more Pods.

Rollback the last Deployment rollout:

```bash
kubectl -n tarzan rollout undo deployment/api
kubectl -n tarzan rollout undo deployment/web
```

## 10. Configuration changes

ConfigMap and Secret environment values are read when Pods start. After updating either object, restart the Deployments:

```bash
kubectl -n tarzan rollout restart deployment/api deployment/web
kubectl -n tarzan rollout status deployment/api
kubectl -n tarzan rollout status deployment/web
```

Changing the PostgreSQL password after initialization also requires updating the password inside PostgreSQL; changing only the Secret does not modify an existing database account.

## 11. Troubleshooting workflow

Start with desired state, then events, then logs:

```bash
kubectl -n tarzan get pods -o wide
kubectl -n tarzan describe pod <POD_NAME>
kubectl -n tarzan get events --sort-by=.lastTimestamp
kubectl -n tarzan logs <POD_NAME> --all-containers --tail=200
kubectl -n tarzan logs <POD_NAME> --all-containers --previous --tail=200
```

### `ImagePullBackOff`

- Confirm the full Harbor repository/tag exists.
- Confirm `harbor-registry` exists in namespace `tarzan`.
- Confirm Harbor's TLS certificate is trusted by every cluster node/container runtime.
- Describe the Pod and read the exact image-pull event.

### PVC remains `Pending`

```bash
kubectl describe pvc -n tarzan postgres-data
kubectl describe pv tarzan-postgres-pv
kubectl get storageclass
```

Check matching capacity, access mode, StorageClass name, and node storage path.

### API cannot connect to PostgreSQL

```bash
kubectl -n tarzan get endpoints postgres
kubectl -n tarzan exec deployment/api -- getent hosts postgres
kubectl -n tarzan logs deployment/api --tail=200
```

Confirm that `DATABASE_URL` uses host `postgres`, not `localhost`.

### Ingress has no address

Creating an Ingress object does not install an Ingress Controller. Confirm that a controller exists and that `ingressClassName: nginx` matches its IngressClass.

## 12. Remove the lab

Delete namespaced workloads while retaining the cluster-scoped PV by default:

```bash
kubectl delete namespace tarzan
```

Because the PV uses reclaim policy `Retain`, its data survives. Delete the PV, StorageClass, and `/var/lib/tarzan/postgres` only when you intentionally want to destroy the database.

## Official references

- [Deployments and ReplicaSets](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [ConfigMaps](https://kubernetes.io/docs/concepts/configuration/configmap/)
- [Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [Persistent Volumes and Claims](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [StorageClasses](https://kubernetes.io/docs/concepts/storage/storage-classes/)
- [Services](https://kubernetes.io/docs/concepts/services-networking/service/)
- [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)
