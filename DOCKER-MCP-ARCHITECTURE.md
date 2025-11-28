# Docker + MCP Architecture for Auto-Checkout

## Overview

This architecture uses:
- **Docker** for consistent, reproducible environments
- **MCP (Model Context Protocol)** for AI-orchestrated browser automation
- **Google Cloud** for hosting and orchestration
- **Residential Proxies** for clean IP egress (CRITICAL)

## Why MCP?

MCP allows an AI to interact with browser automation tools intelligently:
- Adapt to page changes dynamically
- Handle unexpected CAPTCHAs or errors
- Make decisions based on visual context
- Retry with different strategies

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        GOOGLE CLOUD PROJECT                              │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                     Cloud Run / GKE Cluster                        │ │
│  │                                                                    │ │
│  │  ┌──────────────────┐    ┌──────────────────┐                     │ │
│  │  │  MCP Server       │    │  Task Queue      │                     │ │
│  │  │  Container        │◄──►│  (Cloud Tasks)   │                     │ │
│  │  │                   │    │                  │                     │ │
│  │  │  - Tool Registry  │    │  - Scheduled     │                     │ │
│  │  │  - AI Orchestrator│    │    Drops         │                     │ │
│  │  │  - Decision Engine│    │  - Retry Queue   │                     │ │
│  │  └────────┬──────────┘    └──────────────────┘                     │ │
│  │           │                                                        │ │
│  │           ▼                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────┐ │ │
│  │  │              Browser Worker Pool (Docker Containers)          │ │ │
│  │  │                                                               │ │ │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │ │ │
│  │  │  │  Worker 1  │  │  Worker 2  │  │  Worker N  │              │ │ │
│  │  │  │            │  │            │  │            │              │ │ │
│  │  │  │ Playwright │  │ Playwright │  │ Playwright │              │ │ │
│  │  │  │ + Stealth  │  │ + Stealth  │  │ + Stealth  │              │ │ │
│  │  │  │ + Xvfb     │  │ + Xvfb     │  │ + Xvfb     │              │ │ │
│  │  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘              │ │ │
│  │  │        │               │               │                      │ │ │
│  │  └────────┼───────────────┼───────────────┼──────────────────────┘ │ │
│  │           │               │               │                        │ │
│  └───────────┼───────────────┼───────────────┼────────────────────────┘ │
│              │               │               │                          │
└──────────────┼───────────────┼───────────────┼──────────────────────────┘
               │               │               │
               ▼               ▼               ▼
       ┌───────────────────────────────────────────────┐
       │         RESIDENTIAL PROXY SERVICE              │
       │   (Bright Data / Oxylabs / Smartproxy)        │
       │                                                │
       │   - Rotating IPs or Sticky Sessions           │
       │   - US Residential Pool                       │
       │   - Geographic targeting (match shipping)     │
       └───────────────────────┬───────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    RETAILER SITES   │
                    │  (Costco, Target,   │
                    │   Best Buy, etc.)   │
                    └─────────────────────┘
```

## Docker Configuration

### Base Image (Dockerfile)

```dockerfile
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Install system dependencies
RUN apt-get update && apt-get install -y \
    xvfb \
    x11vnc \
    fluxbox \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Install Playwright browsers with stealth patches
RUN npx playwright install chromium

# Copy application code
COPY . .

# Environment variables
ENV DISPLAY=:99
ENV NODE_ENV=production

# Start Xvfb and application
CMD ["./scripts/start.sh"]
```

### Start Script (scripts/start.sh)

```bash
#!/bin/bash

# Start virtual framebuffer for headed mode
Xvfb :99 -screen 0 1920x1080x24 &
sleep 2

# Optional: Start VNC for debugging
x11vnc -display :99 -forever -nopw -quiet &

# Start the MCP server
node dist/mcp-server.js
```

### Docker Compose (docker-compose.yml)

```yaml
version: '3.8'

services:
  mcp-server:
    build:
      context: .
      dockerfile: Dockerfile.mcp
    ports:
      - "3000:3000"
    environment:
      - PROXY_HOST=${PROXY_HOST}
      - PROXY_PORT=${PROXY_PORT}
      - PROXY_USER=${PROXY_USER}
      - PROXY_PASS=${PROXY_PASS}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    volumes:
      - ./config:/app/config
      - ./data:/app/data

  browser-worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    deploy:
      replicas: 3
    environment:
      - DISPLAY=:99
      - PROXY_HOST=${PROXY_HOST}
      - PROXY_PORT=${PROXY_PORT}
      - PROXY_USER=${PROXY_USER}
      - PROXY_PASS=${PROXY_PASS}
      - MCP_SERVER_URL=http://mcp-server:3000
    shm_size: '2gb'  # Required for Chromium
    depends_on:
      - mcp-server

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data

  # Stock monitor (lightweight, no browser)
  monitor:
    build:
      context: .
      dockerfile: Dockerfile.monitor
    environment:
      - REDIS_URL=redis://redis:6379
      - DISCORD_WEBHOOK=${DISCORD_WEBHOOK}

volumes:
  redis-data:
```

## MCP Server Implementation

### MCP Tool Definitions

```typescript
// src/mcp-server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'checkout-bot',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

// Tool: Navigate to URL
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'navigate',
      description: 'Navigate browser to a URL',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to navigate to' },
          waitFor: { type: 'string', description: 'Selector to wait for' },
        },
        required: ['url'],
      },
    },
    {
      name: 'click',
      description: 'Click an element on the page',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector' },
          humanLike: { type: 'boolean', description: 'Use human-like mouse movement' },
        },
        required: ['selector'],
      },
    },
    {
      name: 'type',
      description: 'Type text into an input field',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector' },
          text: { type: 'string', description: 'Text to type' },
          humanLike: { type: 'boolean', description: 'Use human-like typing speed' },
        },
        required: ['selector', 'text'],
      },
    },
    {
      name: 'screenshot',
      description: 'Take a screenshot of the current page',
      inputSchema: {
        type: 'object',
        properties: {
          fullPage: { type: 'boolean', description: 'Capture full page' },
        },
      },
    },
    {
      name: 'checkStock',
      description: 'Check if product is in stock',
      inputSchema: {
        type: 'object',
        properties: {
          retailer: { type: 'string', enum: ['costco', 'target', 'bestbuy'] },
          productUrl: { type: 'string' },
        },
        required: ['retailer', 'productUrl'],
      },
    },
    {
      name: 'addToCart',
      description: 'Add product to cart',
      inputSchema: {
        type: 'object',
        properties: {
          retailer: { type: 'string', enum: ['costco', 'target', 'bestbuy'] },
        },
        required: ['retailer'],
      },
    },
    {
      name: 'checkout',
      description: 'Complete checkout process',
      inputSchema: {
        type: 'object',
        properties: {
          retailer: { type: 'string', enum: ['costco', 'target', 'bestbuy'] },
          cvv: { type: 'string', description: 'Card CVV' },
        },
        required: ['retailer', 'cvv'],
      },
    },
  ],
}));

// Tool execution handler
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'navigate':
      return await browserPool.navigate(args.url, args.waitFor);
    case 'click':
      return await browserPool.click(args.selector, args.humanLike);
    case 'type':
      return await browserPool.type(args.selector, args.text, args.humanLike);
    case 'screenshot':
      return await browserPool.screenshot(args.fullPage);
    case 'checkStock':
      return await retailerModules[args.retailer].checkStock(args.productUrl);
    case 'addToCart':
      return await retailerModules[args.retailer].addToCart();
    case 'checkout':
      return await retailerModules[args.retailer].checkout(args.cvv);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Google Cloud Deployment

### Cloud Run Service (Serverless)

```yaml
# cloud-run-service.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: checkout-bot
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/cpu-throttling: "false"
        run.googleapis.com/execution-environment: gen2
    spec:
      containerConcurrency: 1  # One checkout per container
      timeoutSeconds: 300
      containers:
        - image: gcr.io/PROJECT_ID/checkout-bot:latest
          resources:
            limits:
              cpu: "2"
              memory: "4Gi"
          env:
            - name: PROXY_HOST
              valueFrom:
                secretKeyRef:
                  name: proxy-credentials
                  key: host
            - name: PROXY_USER
              valueFrom:
                secretKeyRef:
                  name: proxy-credentials
                  key: username
            - name: PROXY_PASS
              valueFrom:
                secretKeyRef:
                  name: proxy-credentials
                  key: password
```

### GKE Deployment (For Scale)

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: browser-workers
spec:
  replicas: 5
  selector:
    matchLabels:
      app: browser-worker
  template:
    metadata:
      labels:
        app: browser-worker
    spec:
      containers:
        - name: worker
          image: gcr.io/PROJECT_ID/browser-worker:latest
          resources:
            requests:
              memory: "2Gi"
              cpu: "1"
            limits:
              memory: "4Gi"
              cpu: "2"
          volumeMounts:
            - name: shm
              mountPath: /dev/shm
          env:
            - name: PROXY_HOST
              valueFrom:
                secretKeyRef:
                  name: proxy-credentials
                  key: host
      volumes:
        - name: shm
          emptyDir:
            medium: Memory
            sizeLimit: 2Gi
```

### Terraform Infrastructure

```hcl
# main.tf
provider "google" {
  project = var.project_id
  region  = var.region
}

# VPC with NAT (optional - if not using proxy)
resource "google_compute_network" "vpc" {
  name                    = "checkout-bot-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  name          = "checkout-bot-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.vpc.id
}

# Cloud NAT for outbound (static IP - but still datacenter!)
resource "google_compute_router" "router" {
  name    = "checkout-bot-router"
  region  = var.region
  network = google_compute_network.vpc.id
}

resource "google_compute_address" "nat_ip" {
  name   = "checkout-bot-nat-ip"
  region = var.region
}

resource "google_compute_router_nat" "nat" {
  name                               = "checkout-bot-nat"
  router                             = google_compute_router.router.name
  region                             = var.region
  nat_ip_allocate_option             = "MANUAL_ONLY"
  nat_ips                            = [google_compute_address.nat_ip.self_link]
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}

# Secret Manager for credentials
resource "google_secret_manager_secret" "proxy_credentials" {
  secret_id = "proxy-credentials"
  replication {
    automatic = true
  }
}

# GKE Cluster
resource "google_container_cluster" "primary" {
  name     = "checkout-bot-cluster"
  location = var.region

  initial_node_count = 1

  node_config {
    machine_type = "e2-standard-4"
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]
  }
}

# Cloud Scheduler for drop monitoring
resource "google_cloud_scheduler_job" "monitor" {
  name        = "stock-monitor"
  description = "Check stock every minute"
  schedule    = "* * * * *"  # Every minute
  time_zone   = "America/Los_Angeles"

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_service.monitor.status[0].url}/check"

    oidc_token {
      service_account_email = google_service_account.invoker.email
    }
  }
}
```

## Proxy Configuration

### CRITICAL: Route Through Residential Proxy

```typescript
// src/browser/launch.ts
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(StealthPlugin());

export async function launchBrowser(proxyConfig: ProxyConfig) {
  return await chromium.launch({
    headless: false,  // Use Xvfb for headed mode
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
    ],
    proxy: {
      // MUST use residential proxy, not GCP IP!
      server: `http://${proxyConfig.host}:${proxyConfig.port}`,
      username: proxyConfig.username,
      password: proxyConfig.password,
    },
  });
}
```

### Proxy Providers for GCP

| Provider | Type | Cost | Sticky Sessions | Best For |
|----------|------|------|-----------------|----------|
| **Bright Data** | Residential | $8.40/GB | 30 min | High volume |
| **Oxylabs** | Residential | $8/GB | 30 min | Reliability |
| **Smartproxy** | Residential | $7/GB | 30 min | Budget |
| **NetNut** | ISP | $6/GB | 24 hr | Speed + stability |

## Cost Estimation

### Google Cloud

| Resource | Spec | Monthly Cost |
|----------|------|--------------|
| Cloud Run | 2 vCPU, 4GB RAM | ~$30-50 |
| GKE (5 nodes) | e2-standard-4 | ~$200-300 |
| Cloud Storage | Logs, screenshots | ~$5 |
| Cloud Scheduler | Stock checks | ~$1 |
| **Total GCP** | | **~$250-350/mo** |

### Proxy (Variable)

| Usage | Cost |
|-------|------|
| Light (10 GB/mo) | ~$80 |
| Medium (50 GB/mo) | ~$400 |
| Heavy (100 GB/mo) | ~$800 |

### Total

| Tier | GCP | Proxy | Total |
|------|-----|-------|-------|
| **Light** | $50 | $80 | **$130/mo** |
| **Medium** | $250 | $400 | **$650/mo** |
| **Heavy** | $350 | $800 | **$1,150/mo** |

## Development vs Production

### Local Development

```bash
# Start local stack
docker-compose -f docker-compose.dev.yml up

# Run MCP server locally
npm run dev:mcp

# Test with Claude Desktop
# Add to claude_desktop_config.json:
{
  "mcpServers": {
    "checkout-bot": {
      "command": "node",
      "args": ["dist/mcp-server.js"]
    }
  }
}
```

### Production Deployment

```bash
# Build and push images
docker build -t gcr.io/PROJECT_ID/checkout-bot:latest .
docker push gcr.io/PROJECT_ID/checkout-bot:latest

# Deploy with Terraform
cd terraform
terraform init
terraform apply

# Or deploy to Cloud Run
gcloud run deploy checkout-bot \
  --image gcr.io/PROJECT_ID/checkout-bot:latest \
  --platform managed \
  --region us-central1 \
  --memory 4Gi \
  --cpu 2
```

## Important Notes

### GCP IP vs Residential Proxy

```
❌ WRONG: GCP VM → Costco.com
   Result: Blocked by Akamai (datacenter IP)

✅ RIGHT: GCP VM → Residential Proxy → Costco.com
   Result: Appears as home user
```

### Why This Matters

1. **GCP provides**: Fast compute, scheduling, scalability, reliability
2. **Proxy provides**: Clean IP that won't be blocked
3. **Docker provides**: Consistent environment everywhere
4. **MCP provides**: Intelligent orchestration via AI

The GCP static IP is for YOUR infrastructure (SSH, monitoring, etc.) - NOT for the checkout traffic. All checkout traffic MUST route through residential proxies.

## Sources

- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)
- [Playwright Docker](https://playwright.dev/docs/docker)
- [Google Cloud Run](https://cloud.google.com/run)
- [Bright Data Proxy Integration](https://brightdata.com/integration)
