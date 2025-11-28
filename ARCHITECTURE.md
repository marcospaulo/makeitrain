# Make It Rain - Auto-Purchase Bot Architecture

## Overview

This document outlines the architecture for an automated inventory purchasing bot targeting retail sites (Target, Best Buy, and extensible to others). The system uses Playwright with stealth enhancements, proxy rotation, and human-like behavior simulation.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ORCHESTRATOR                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Task       │  │   Account    │  │   Proxy      │  │   Config     │    │
│  │   Scheduler  │  │   Manager    │  │   Pool       │  │   Manager    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │   Target     │ │   Best Buy   │ │   Future     │
            │   Module     │ │   Module     │ │   Retailers  │
            └──────────────┘ └──────────────┘ └──────────────┘
                    │               │               │
                    ▼               ▼               ▼
            ┌─────────────────────────────────────────────────┐
            │              BROWSER ENGINE                      │
            │  ┌─────────────────────────────────────────┐    │
            │  │  Playwright + Stealth Plugin             │    │
            │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐    │    │
            │  │  │Fingerprint│ │Behavior │ │ Proxy   │    │    │
            │  │  │Spoofing  │ │Simulator│ │Rotation │    │    │
            │  │  └─────────┘ └─────────┘ └─────────┘    │    │
            │  └─────────────────────────────────────────┘    │
            └─────────────────────────────────────────────────┘
                                    │
                                    ▼
            ┌─────────────────────────────────────────────────┐
            │              MONITORING & ALERTS                 │
            │  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
            │  │ Discord  │ │  SMS     │ │  Logs    │        │
            │  │ Webhooks │ │ (Twilio) │ │ (File)   │        │
            │  └──────────┘ └──────────┘ └──────────┘        │
            └─────────────────────────────────────────────────┘
```

## Core Components

### 1. Orchestrator

The central coordinator managing all bot operations.

```typescript
interface Orchestrator {
  taskScheduler: TaskScheduler;
  accountManager: AccountManager;
  proxyPool: ProxyPool;
  configManager: ConfigManager;

  startTask(task: PurchaseTask): Promise<TaskResult>;
  pauseAll(): void;
  resumeAll(): void;
  getStatus(): SystemStatus;
}
```

**Responsibilities:**
- Coordinate multiple concurrent purchase tasks
- Load balance across available proxies and accounts
- Handle rate limiting and retry logic
- Provide unified logging and monitoring

### 2. Task Scheduler

Manages the queue of purchase tasks.

```typescript
interface PurchaseTask {
  id: string;
  retailer: 'target' | 'bestbuy' | string;
  sku: string;
  productUrl: string;
  maxPrice: number;
  quantity: number;
  account: AccountConfig;
  priority: 'high' | 'normal' | 'low';
  mode: 'monitor' | 'instant';
  fulfillment: 'shipping' | 'pickup';
  pickupStoreId?: string;
}

interface TaskScheduler {
  addTask(task: PurchaseTask): void;
  removeTask(taskId: string): void;
  prioritize(taskId: string): void;
  getQueue(): PurchaseTask[];
}
```

### 3. Account Manager

Handles retailer account credentials and session management.

```typescript
interface AccountConfig {
  id: string;
  retailer: string;
  email: string;
  password: string;
  paymentMethod: PaymentConfig;
  shippingAddress: AddressConfig;
  cookies?: CookieData[];
  lastUsed?: Date;
  status: 'active' | 'locked' | 'cooldown';
}

interface AccountManager {
  getAccount(retailer: string): AccountConfig | null;
  markAsLocked(accountId: string): void;
  setCooldown(accountId: string, duration: number): void;
  saveCookies(accountId: string, cookies: CookieData[]): void;
  loadCookies(accountId: string): CookieData[];
}
```

### 4. Proxy Pool

Manages proxy rotation and health checking.

```typescript
interface ProxyConfig {
  id: string;
  type: 'residential' | 'isp' | 'datacenter';
  host: string;
  port: number;
  username?: string;
  password?: string;
  location: string;
  lastUsed?: Date;
  failureCount: number;
  status: 'active' | 'banned' | 'cooldown';
}

interface ProxyPool {
  getProxy(retailer: string, location?: string): ProxyConfig;
  markAsBanned(proxyId: string, retailer: string): void;
  rotateProxy(currentProxyId: string): ProxyConfig;
  healthCheck(): Promise<ProxyHealth[]>;
}
```

### 5. Browser Engine

The Playwright-based browser automation layer.

```typescript
interface BrowserEngine {
  launch(config: BrowserConfig): Promise<BrowserContext>;
  applyStealthPlugins(context: BrowserContext): Promise<void>;
  simulateHumanBehavior(page: Page): Promise<void>;
  handleCaptcha(page: Page): Promise<boolean>;
  screenshot(page: Page, name: string): Promise<void>;
}

interface BrowserConfig {
  headless: boolean;
  proxy?: ProxyConfig;
  userAgent?: string;
  viewport: { width: number; height: number };
  locale: string;
  timezone: string;
  geolocation?: { latitude: number; longitude: number };
}
```

### 6. Retailer Modules

Pluggable modules for each supported retailer.

```typescript
interface RetailerModule {
  name: string;
  baseUrl: string;

  login(page: Page, account: AccountConfig): Promise<boolean>;
  searchProduct(page: Page, sku: string): Promise<ProductInfo>;
  checkStock(page: Page, productUrl: string): Promise<StockStatus>;
  addToCart(page: Page, productUrl: string, quantity: number): Promise<boolean>;
  checkout(page: Page, fulfillment: FulfillmentConfig): Promise<CheckoutResult>;

  // Retailer-specific methods
  handleQueueBypass?(page: Page): Promise<boolean>;
  handleShapeProtection?(page: Page): Promise<boolean>;
}
```

## Technology Stack

### Core
- **Runtime:** Node.js 20+ (LTS)
- **Language:** TypeScript 5.x
- **Browser Automation:** Playwright
- **Stealth:** playwright-extra + puppeteer-extra-plugin-stealth

### Supporting Libraries
- **HTTP Client:** Got or Axios (for API requests)
- **Database:** SQLite (local) or PostgreSQL (multi-instance)
- **Queue:** Bull (Redis-backed job queue)
- **Logging:** Pino or Winston
- **Config:** dotenv + convict

### Monitoring & Alerts
- **Discord:** discord.js for webhooks
- **SMS:** Twilio SDK
- **Metrics:** Prometheus + Grafana (optional)

## Operational Modes

### 1. Monitor Mode
Continuously monitors product pages for stock availability.

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Monitor │───▶│ Stock   │───▶│ Trigger │───▶│ Checkout│
│ Product │    │ Check   │    │ Task    │    │ Flow    │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
     │              │
     │              ▼
     │         ┌─────────┐
     └────────▶│ Delay   │ (configurable polling interval)
               └─────────┘
```

### 2. Instant Mode
Pre-configures cart and waits for a specific drop time.

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Pre-    │───▶│ Wait    │───▶│ Refresh │───▶│ Checkout│
│ Login   │    │ Timer   │    │ & Cart  │    │ Flow    │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
```

### 3. Hybrid Mode
Combines monitoring with instant checkout on detection.

## Data Flow

### Purchase Flow Sequence

```
1. User configures task (SKU, account, proxy preferences)
2. Orchestrator assigns proxy and account
3. Browser launches with stealth configuration
4. Login to retailer (load cookies if available)
5. Navigate to product page
6. Check stock status
7. If in stock:
   a. Add to cart
   b. Proceed to checkout
   c. Apply payment method
   d. Confirm purchase
   e. Save order confirmation
   f. Send notification
8. If out of stock:
   a. Wait (with jitter)
   b. Return to step 5
```

## Directory Structure

```
makeitrain/
├── src/
│   ├── core/
│   │   ├── orchestrator.ts
│   │   ├── task-scheduler.ts
│   │   ├── account-manager.ts
│   │   ├── proxy-pool.ts
│   │   └── config-manager.ts
│   ├── browser/
│   │   ├── engine.ts
│   │   ├── stealth.ts
│   │   ├── behavior.ts
│   │   └── fingerprint.ts
│   ├── retailers/
│   │   ├── base.ts
│   │   ├── target/
│   │   │   ├── index.ts
│   │   │   ├── login.ts
│   │   │   ├── cart.ts
│   │   │   └── checkout.ts
│   │   └── bestbuy/
│   │       ├── index.ts
│   │       ├── login.ts
│   │       ├── cart.ts
│   │       └── checkout.ts
│   ├── notifications/
│   │   ├── discord.ts
│   │   ├── sms.ts
│   │   └── email.ts
│   ├── utils/
│   │   ├── delays.ts
│   │   ├── logger.ts
│   │   └── crypto.ts
│   └── index.ts
├── config/
│   ├── accounts.json.example
│   ├── proxies.json.example
│   └── tasks.json.example
├── data/
│   ├── cookies/
│   ├── screenshots/
│   └── logs/
├── tests/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── ANTI-DETECTION.md
│   ├── PROXIES.md
│   ├── RETAILERS.md
│   └── ROADMAP.md
├── package.json
├── tsconfig.json
└── README.md
```

## Scalability Considerations

### Single Instance
- Handles 5-10 concurrent tasks
- Local SQLite database
- Single proxy pool

### Multi-Instance (Future)
- Redis for shared state
- PostgreSQL for persistence
- Distributed proxy pools
- Load balancer for task distribution

## Security Considerations

1. **Credential Storage:** Encrypt sensitive data at rest
2. **Proxy Credentials:** Environment variables or encrypted config
3. **Session Data:** Secure cookie storage with encryption
4. **Logs:** Redact sensitive information from logs

## Sources

- [ScrapeOps - Making Playwright Undetectable](https://scrapeops.io/playwright-web-scraping-playbook/nodejs-playwright-make-playwright-undetectable/)
- [Bright Data - Playwright Stealth](https://brightdata.com/blog/how-tos/avoid-bot-detection-with-playwright-stealth)
- [Tidal Market - Retail Botting Guide](https://www.tidalmarket.com/blog/retail-botting-guide)
- [ZenRows - Playwright Fingerprinting](https://www.zenrows.com/blog/playwright-fingerprint)
