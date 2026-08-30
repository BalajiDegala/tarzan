{{/* Expand the chart name. */}}
{{- define "tarzan.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/* Create a release-scoped name. */}}
{{- define "tarzan.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name (include "tarzan.name" .) | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/* Common labels. */}}
{{- define "tarzan.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/part-of: tarzan
{{- end }}

{{/* Component selector labels. */}}
{{- define "tarzan.selectorLabels" -}}
app.kubernetes.io/name: {{ .component }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/part-of: tarzan
{{- end }}

{{/* Application Secret name. */}}
{{- define "tarzan.secretName" -}}
{{- if .Values.secret.create }}
{{- printf "%s-secrets" (include "tarzan.fullname" .) }}
{{- else }}
{{- required "secret.existingSecret is required when secret.create=false" .Values.secret.existingSecret }}
{{- end }}
{{- end }}

{{/* PostgreSQL PVC name. */}}
{{- define "tarzan.postgresPvcName" -}}
{{- if .Values.postgres.persistence.existingClaim }}
{{- .Values.postgres.persistence.existingClaim }}
{{- else }}
{{- printf "%s-postgres-data" (include "tarzan.fullname" .) }}
{{- end }}
{{- end }}
