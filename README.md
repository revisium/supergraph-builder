# Supergraph Builder

<div align="center">

[![License](https://img.shields.io/github/license/revisium/supergraph-builder)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11.0-red.svg)](https://nestjs.com/)

**Apollo Federation supergraph composition service**

</div>

## Overview

A simple service that keeps your Apollo Federation supergraph updated by continuously fetching subgraph schemas and composing them. Optionally publishes schema changes to a registry (GraphQL Hive). Built with NestJS and TypeScript.

### Features

- **Continuous Schema Fetching** - Polls subgraph endpoints to keep schemas up-to-date
- **Automatic Composition** - Builds Apollo Federation supergraph from fetched schemas
- **Registry Publishing** - Optionally publishes schema changes to GraphQL Hive
- **Retry Logic** - Handles temporary network failures with exponential backoff
- **Docker Ready** - Containerized deployment
- **Health Checks** - Built-in monitoring endpoints

## Quick Start

### Prerequisites

- Docker or Kubernetes cluster
- Running GraphQL subgraph services

### How Projects Work

The service organizes subgraphs into **projects** using environment variables:

- Each project can have multiple subgraphs: `SUBGRAPH_<PROJECT>_<SERVICE>=<url>`
- Each project gets its own supergraph endpoint: `/supergraph/<project>`
- Example: `SUBGRAPH_SHOP_USERS` and `SUBGRAPH_SHOP_PRODUCTS` create a "shop" project accessible at `/supergraph/shop`

### Docker

1. **Run with Docker**:

```bash
docker run -d \
  --name supergraph-builder \
  -p 3000:3000 \
  -e SUBGRAPH_MYPROJECT_USERS=http://users-service:4001/graphql \
  -e SUBGRAPH_MYPROJECT_PRODUCTS=http://products-service:4002/graphql \
  revisium/supergraph-builder:v0.2.0
```

2. **Get your supergraph**:

```bash
curl http://localhost:3000/supergraph/myproject
```

## Docker Compose

```yaml
version: '3.8'
services:
  supergraph-builder:
    image: revisium/supergraph-builder:v0.2.0
    ports:
      - '3000:3000'
    environment:
      SUBGRAPH_MYPROJECT_USERS: http://users-service:4001/graphql
      SUBGRAPH_MYPROJECT_PRODUCTS: http://products-service:4002/graphql
      SUBGRAPH_MYPROJECT_POLL_INTERVAL_S: 30
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health/readiness']
      interval: 30s
      timeout: 10s
      retries: 3
```

## Kubernetes

### Helm Chart

Create a `values.yaml` file:

```yaml
# values.yaml
image:
  repository: revisium/supergraph-builder
  tag: v0.2.0
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80
  targetPort: 8080

ingress:
  enabled: false

resources:
  limits:
    cpu: 500m
    memory: 128Mi
  requests:
    cpu: 250m
    memory: 64Mi

env:
  SUBGRAPH_MYPROJECT_USERS: 'http://users-service:4001/graphql'
  SUBGRAPH_MYPROJECT_PRODUCTS: 'http://products-service:4002/graphql'
  SUBGRAPH_MYPROJECT_POLL_INTERVAL_S: '30'

healthCheck:
  enabled: true
  livenessPath: /health/liveness
  readinessPath: /health/readiness
```

Create a basic Helm template (`templates/deployment.yaml`):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "supergraph-builder.fullname" . }}
  labels:
    app: {{ include "supergraph-builder.name" . }}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: {{ include "supergraph-builder.name" . }}
  template:
    metadata:
      labels:
        app: {{ include "supergraph-builder.name" . }}
    spec:
      containers:
      - name: supergraph-builder
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
        imagePullPolicy: {{ .Values.image.pullPolicy }}
        ports:
        - containerPort: {{ .Values.service.targetPort }}
        env:
        {{- range $key, $value := .Values.env }}
        - name: {{ $key }}
          value: {{ $value | quote }}
        {{- end }}
        {{- if .Values.healthCheck.enabled }}
        livenessProbe:
          httpGet:
            path: {{ .Values.healthCheck.livenessPath }}
            port: {{ .Values.service.targetPort }}
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: {{ .Values.healthCheck.readinessPath }}
            port: {{ .Values.service.targetPort }}
          initialDelaySeconds: 5
          periodSeconds: 5
        {{- end }}
        resources:
          {{- toYaml .Values.resources | nindent 10 }}
---
apiVersion: v1
kind: Service
metadata:
  name: {{ include "supergraph-builder.fullname" . }}
  labels:
    app: {{ include "supergraph-builder.name" . }}
spec:
  type: {{ .Values.service.type }}
  ports:
  - port: {{ .Values.service.port }}
    targetPort: {{ .Values.service.targetPort }}
  selector:
    app: {{ include "supergraph-builder.name" . }}
```

Deploy with Helm:

```bash
helm install supergraph-builder ./chart -f values.yaml
```

### Simple Kubernetes YAML

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: supergraph-builder
spec:
  replicas: 1
  selector:
    matchLabels:
      app: supergraph-builder
  template:
    metadata:
      labels:
        app: supergraph-builder
    spec:
      containers:
        - name: supergraph-builder
          image: revisium/supergraph-builder:v0.2.0
          ports:
            - containerPort: 3000
          env:
            - name: SUBGRAPH_MYPROJECT_USERS
              value: 'http://users-service:4001/graphql'
            - name: SUBGRAPH_MYPROJECT_PRODUCTS
              value: 'http://products-service:4002/graphql'
          livenessProbe:
            httpGet:
              path: /health/liveness
              port: 3000
            initialDelaySeconds: 30
          readinessProbe:
            httpGet:
              path: /health/readiness
              port: 3000
            initialDelaySeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: supergraph-builder-service
spec:
  selector:
    app: supergraph-builder
  ports:
    - port: 80
      targetPort: 3000
```

Apply with:

```bash
kubectl apply -f supergraph-builder.yaml
```

## Configuration

### Environment Variables

| Variable                                | Default | Description                              |
| --------------------------------------- |---------| ---------------------------------------- |
| `SUBGRAPH_<PROJECT>_<SERVICE>`          | -       | Subgraph GraphQL endpoint URL (required) |
| `SUBGRAPH_<PROJECT>_POLL_INTERVAL_S`    | `60`    | Schema polling interval in seconds       |
| `SUBGRAPH_<PROJECT>_MAX_RUNTIME_ERRORS` | `5`     | Maximum retry attempts                   |
| `PORT`                                  | `8080`  | HTTP server port                         |

### GraphQL Hive (Optional)

| Variable                               | Description                         |
| -------------------------------------- | ----------------------------------- |
| `SUBGRAPH_<PROJECT>_HIVE_TARGET`       | Hive project target ID              |
| `SUBGRAPH_<PROJECT>_HIVE_ACCESS_TOKEN` | Hive API access token               |
| `SUBGRAPH_<PROJECT>_HIVE_AUTHOR`       | Author name for schema publications |

### Examples

**Single Project**:

```bash
export SUBGRAPH_SHOP_USERS=http://localhost:4001/graphql
export SUBGRAPH_SHOP_PRODUCTS=http://localhost:4002/graphql
export SUBGRAPH_SHOP_POLL_INTERVAL_S=30
```

**Multiple Projects**:

```bash
# Project 1
export SUBGRAPH_SHOP_USERS=http://localhost:4001/graphql
export SUBGRAPH_SHOP_PRODUCTS=http://localhost:4002/graphql

# Project 2
export SUBGRAPH_ANALYTICS_EVENTS=http://localhost:4003/graphql
export SUBGRAPH_ANALYTICS_METRICS=http://localhost:4004/graphql
```

## API

### Health Check

```http
GET /health
```

Returns service status (200 OK if healthy).

### Get Supergraph

```http
GET /supergraph/:projectId
```

Returns the composed supergraph SDL for the project.

**Example**:

```bash
curl http://localhost:3000/supergraph/shop
```

## Retry Strategy

The service handles network failures with exponential backoff:

| Attempt | Delay Range      |
| ------- | ---------------- |
| 1       | 750ms - 1250ms   |
| 2       | 1500ms - 2500ms  |
| 3       | 3000ms - 5000ms  |
| 4+      | Up to 30 seconds |

Logs show retry attempts and successful recoveries:

```
[WARN] Retry attempt 2/6 for http://users:4001/graphql in 1847ms
[INFO] Successfully fetched schema from http://users:4001/graphql after 3 attempts
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Start development server
npm run start:dev

# Build for production
npm run build
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- [Issues](https://github.com/revisium/supergraph-builder/issues)
