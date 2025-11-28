# Implementation Roadmap

## Overview

This roadmap outlines the phased implementation of the Make It Rain auto-purchase bot. Each phase builds on the previous, allowing for incremental testing and validation.

---

## Phase 1: Foundation

**Goal:** Establish core infrastructure and basic browser automation

### Tasks

- [ ] **Project Setup**
  - Initialize Node.js project with TypeScript
  - Configure ESLint, Prettier
  - Set up directory structure per ARCHITECTURE.md
  - Create configuration schemas

- [ ] **Browser Engine - Basic**
  - Implement Playwright wrapper
  - Add stealth plugin integration
  - Create browser launch configurations
  - Implement screenshot/debug utilities

- [ ] **Configuration System**
  - Account config loader (encrypted storage)
  - Proxy config loader
  - Task config schema
  - Environment variable handling

- [ ] **Logging & Monitoring**
  - Structured logging (Pino)
  - Log levels and rotation
  - Error tracking

### Deliverables
- Working Playwright instance with stealth
- Pass basic bot detection tests (sannysoft.com)
- Configuration loading from files

---

## Phase 2: Core Automation

**Goal:** Implement human-like behavior simulation and session management

### Tasks

- [ ] **Behavior Simulator**
  - Mouse movement with bezier curves
  - Human-like typing with variable delays
  - Scroll behavior simulation
  - Random delay utilities

- [ ] **Session Management**
  - Cookie persistence (save/load)
  - Session warmup routines
  - Login state verification

- [ ] **Proxy Integration**
  - Proxy pool manager
  - Health checking
  - Rotation strategies (per-request, sticky)
  - Ban detection

- [ ] **Fingerprint Management**
  - Consistent fingerprint per account
  - playwright-with-fingerprints integration
  - Fingerprint validation

### Deliverables
- Behavioral score >60% on bot.incolumitas.com
- Reliable proxy rotation
- Persistent sessions across runs

---

## Phase 3: Target Module

**Goal:** Complete Target automation from login to checkout

### Tasks

- [ ] **Target Authentication**
  - Login flow implementation
  - Session cookie management
  - Account lock detection

- [ ] **Target Product Operations**
  - Stock checking (regular + Shape-protected)
  - Add to cart (shipping + pickup)
  - Quantity handling

- [ ] **Target Checkout**
  - Checkout flow automation
  - Payment selection (saved cards)
  - Order confirmation capture

- [ ] **Target-Specific Handling**
  - Shape protection detection/evasion
  - Hype mode vs regular mode
  - Error recovery

### Deliverables
- Successful manual test purchases on Target
- Handle both regular and hype items
- <30 second checkout time

---

## Phase 4: Best Buy Module

**Goal:** Complete Best Buy automation with queue handling

### Tasks

- [ ] **Best Buy Authentication**
  - Login flow
  - TotalTech member detection
  - Session persistence

- [ ] **Best Buy Product Operations**
  - Stock monitoring
  - Multi-click add to cart
  - Cart verification

- [ ] **Best Buy Checkout**
  - Multi-step checkout handling
  - CVV re-entry
  - Human verification handling

- [ ] **Queue System**
  - Queue detection
  - Wait and monitor
  - Auto-proceed when cleared

### Deliverables
- Successful test purchases on Best Buy
- Queue handling (wait mode)
- Multi-click checkout working

---

## Phase 5: Orchestration

**Goal:** Build task scheduling and multi-account management

### Tasks

- [ ] **Task Scheduler**
  - Task queue implementation
  - Priority handling
  - Concurrent task limits

- [ ] **Account Manager**
  - Multi-account rotation
  - Cooldown tracking
  - Lock status monitoring

- [ ] **Orchestrator**
  - Coordinate browser instances
  - Assign proxies to tasks
  - Handle failures and retries

- [ ] **CLI Interface**
  - Start/stop tasks
  - View status
  - Add/remove products

### Deliverables
- Run multiple concurrent purchase tasks
- Automatic failover on errors
- Basic CLI for operation

---

## Phase 6: Notifications & Monitoring

**Goal:** Real-time alerts and operational visibility

### Tasks

- [ ] **Discord Integration**
  - Webhook notifications
  - Stock alerts
  - Purchase confirmations
  - Error alerts

- [ ] **SMS Notifications**
  - Twilio integration
  - Critical alerts only
  - Configurable thresholds

- [ ] **Dashboard (Optional)**
  - Task status view
  - Success/failure metrics
  - Proxy health overview

### Deliverables
- Real-time Discord notifications
- SMS for critical events
- Visibility into bot operations

---

## Phase 7: Advanced Features

**Goal:** Optimize performance and add advanced capabilities

### Tasks

- [ ] **Monitor Mode**
  - Continuous stock monitoring
  - Configurable check intervals
  - Instant trigger on availability

- [ ] **CAPTCHA Handling**
  - Detection implementation
  - 2Captcha/Capsolver integration
  - Manual intervention fallback

- [ ] **Performance Optimization**
  - Request interception (block images/fonts)
  - Caching static assets
  - Connection pooling

- [ ] **Analytics**
  - Success rate tracking
  - Proxy performance metrics
  - Retailer-specific stats

### Deliverables
- 24/7 monitoring capability
- Automated CAPTCHA solving
- Performance metrics

---

## Phase 8: Extensibility

**Goal:** Make it easy to add new retailers

### Tasks

- [ ] **Plugin Architecture**
  - Retailer module interface
  - Hot-reload modules
  - Shared utilities

- [ ] **Documentation**
  - API documentation
  - Module development guide
  - Configuration reference

- [ ] **Testing Framework**
  - Unit tests for core
  - Integration tests per retailer
  - Mock server for testing

### Deliverables
- Easy to add new retailers
- Comprehensive documentation
- Test coverage >70%

---

## Technology Decisions

### Confirmed Stack

| Component | Technology | Reason |
|-----------|------------|--------|
| Runtime | Node.js 20+ | LTS, good async support |
| Language | TypeScript | Type safety, better DX |
| Browser | Playwright | Best stealth plugin support |
| Stealth | playwright-extra + stealth plugin | Most maintained |
| Database | SQLite (local) | Simple, no server needed |
| Logging | Pino | Fast, structured |
| Queue | Bull (if needed) | Redis-backed, reliable |

### To Evaluate

| Component | Options | Decision Point |
|-----------|---------|----------------|
| Proxy Provider | Bright Data, Oxylabs, Smartproxy | Phase 2 - test all three |
| CAPTCHA Service | 2Captcha, Capsolver, Anti-Captcha | Phase 7 - compare solve rates |
| Hosting | Local, VPS, Cloud Functions | Phase 5 - based on scale needs |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Bot detection pass rate | >90% on test sites |
| Checkout success rate | >70% when stock available |
| Time to checkout | <30 seconds |
| System uptime | >99% during drops |
| False positive rate | <5% stock alerts |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Account bans | Multiple accounts, slow warmup |
| IP bans | Proxy rotation, residential IPs |
| Detection evolution | Regular testing, quick updates |
| Legal concerns | Personal use only, no resale |
| Rate limits | Respectful delays, multiple IPs |

---

## Getting Started

### Prerequisites

```bash
# Node.js 20+
node --version

# Install dependencies
npm init -y
npm install playwright playwright-extra puppeteer-extra-plugin-stealth
npm install typescript @types/node tsx
npm install pino dotenv

# Dev dependencies
npm install -D eslint prettier @typescript-eslint/parser
```

### Initial Test

```typescript
// test-stealth.ts
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(StealthPlugin());

async function testStealth() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://bot.sannysoft.com/');
  await page.screenshot({ path: 'stealth-test.png' });

  console.log('Check stealth-test.png for results');
  await browser.close();
}

testStealth();
```

```bash
npx tsx test-stealth.ts
```

---

## Notes

- Start with headed mode (headless: false) for development
- Test extensively before any real purchases
- Keep accounts "warm" with regular legitimate browsing
- Monitor proxy health continuously
- Never hardcode credentials - use environment variables
- Respect rate limits to avoid detection

---

## References

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [ANTI-DETECTION.md](./ANTI-DETECTION.md) - Stealth techniques
- [PROXIES.md](./PROXIES.md) - Proxy strategy
- [RETAILERS.md](./RETAILERS.md) - Target & Best Buy specifics
