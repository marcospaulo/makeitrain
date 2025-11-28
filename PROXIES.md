# Proxy Strategy Guide

## Overview

Proxies are critical for avoiding IP-based detection and rate limiting. This guide covers proxy types, selection strategies, and implementation details for retail botting.

## Proxy Types

### 1. Residential Proxies

**What:** IP addresses from real ISPs assigned to homeowners.

**Pros:**
- Most legitimate-looking traffic
- Hard to detect and block
- Large IP pools available

**Cons:**
- Most expensive option
- Speed can vary
- Session stability varies

**Best for:** Target, high-security sites, initial account creation

**Providers (2025):**
| Provider | Pool Size | Price | Sticky Sessions |
|----------|-----------|-------|-----------------|
| Bright Data | 72M+ | $8.40/GB | Up to 30 min |
| Oxylabs | 100M+ | $8/GB | Up to 30 min |
| Smartproxy | 55M+ | $7/GB | Up to 30 min |
| NetNut | 85M+ | $6/GB | Up to 24 hr |

### 2. ISP Proxies (Static Residential)

**What:** Datacenter IPs registered with residential ISPs.

**Pros:**
- Speed of datacenter + legitimacy of residential
- Stable, consistent IPs
- No rotation needed
- Great for checkout stability

**Cons:**
- Limited availability
- More expensive than datacenter
- Smaller pools

**Best for:** Best Buy, checkout flows, queue bypass

**Providers (2025):**
| Provider | Pool Size | Price | Notes |
|----------|-----------|-------|-------|
| Bright Data | 700K+ | $15/IP/month | Premium quality |
| NetNut | 1M+ | $12/IP/month | Large ISP network |
| Oxylabs | 400K+ | $15/IP/month | Enterprise grade |

### 3. Datacenter Proxies

**What:** IPs from cloud/datacenter providers.

**Pros:**
- Fastest speeds
- Cheapest option
- Unlimited bandwidth often included

**Cons:**
- Easily detected
- Often pre-banned
- Not suitable for most retail sites

**Best for:** Low-security sites, initial testing, monitoring-only tasks

### 4. Mobile Proxies

**What:** IPs from mobile carriers (4G/5G).

**Pros:**
- Highest trust level
- Shared IPs (hard to ban)
- Rotating by nature

**Cons:**
- Most expensive
- Slowest speeds
- Limited availability

**Best for:** Account creation, heavily protected sites

## Proxy Selection by Retailer

### Target
```
Recommended: Residential rotating
Rotation: Per request or 5-10 min sticky
Location: Match to shipping address state
Notes:
- Target tracks IP changes closely
- Use same proxy region as account address
- Avoid mixing proxy types mid-session
- Cookies REQUIRED for hype products
```

### Best Buy
```
Recommended: ISP/Static residential
Rotation: None (static per task)
Location: US only (NY, VA, Chicago preferred)
Notes:
- Queue system requires stable IP
- Fast proxies help with multi-click checkout
- ISP proxies have best success rate
```

### Walmart
```
Recommended: Private residential or EU residential
Rotation: 5-10 min sticky
Location: US preferred, EU works (less trafficked)
Notes:
- Less aggressive than Target/BestBuy
- EU residential IPs often cleaner
```

### Amazon
```
Recommended: Fast ISP or premium datacenter
Rotation: Static per account
Location: US, near shipping address
Notes:
- Speed is priority
- One dedicated IP per account
- Pre-lock accounts to build trust
```

## Proxy Rotation Strategies

### Per-Request Rotation

```typescript
class RotatingProxyPool {
  private proxies: ProxyConfig[];
  private currentIndex = 0;

  getNext(): ProxyConfig {
    const proxy = this.proxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
    return proxy;
  }
}

// Usage with Playwright
const proxy = proxyPool.getNext();
const context = await browser.newContext({
  proxy: {
    server: `http://${proxy.host}:${proxy.port}`,
    username: proxy.username,
    password: proxy.password,
  },
});
```

### Sticky Sessions

```typescript
class StickyProxyManager {
  private sessions: Map<string, { proxy: ProxyConfig; expires: Date }> = new Map();

  getProxyForSession(sessionId: string, durationMs: number = 600000): ProxyConfig {
    const existing = this.sessions.get(sessionId);

    if (existing && existing.expires > new Date()) {
      return existing.proxy;
    }

    const proxy = this.pool.getNext();
    this.sessions.set(sessionId, {
      proxy,
      expires: new Date(Date.now() + durationMs),
    });

    return proxy;
  }
}
```

### Geographic Targeting

```typescript
interface GeoProxy {
  proxy: ProxyConfig;
  state: string;
  city?: string;
}

class GeoProxyPool {
  private proxyByState: Map<string, ProxyConfig[]> = new Map();

  getProxyForLocation(state: string): ProxyConfig | null {
    const stateProxies = this.proxyByState.get(state);
    if (!stateProxies?.length) {
      // Fallback to any US proxy
      return this.getAnyUSProxy();
    }
    return stateProxies[Math.floor(Math.random() * stateProxies.length)];
  }
}
```

## Proxy Health Management

### Health Check Implementation

```typescript
interface ProxyHealth {
  proxyId: string;
  latency: number;
  working: boolean;
  lastChecked: Date;
  consecutiveFailures: number;
}

class ProxyHealthChecker {
  private healthMap: Map<string, ProxyHealth> = new Map();

  async checkProxy(proxy: ProxyConfig): Promise<ProxyHealth> {
    const start = Date.now();
    let working = false;
    let latency = 0;

    try {
      const response = await fetch('https://httpbin.org/ip', {
        agent: new HttpsProxyAgent(`http://${proxy.host}:${proxy.port}`),
        timeout: 10000,
      });

      working = response.ok;
      latency = Date.now() - start;
    } catch (error) {
      working = false;
    }

    const health: ProxyHealth = {
      proxyId: proxy.id,
      latency,
      working,
      lastChecked: new Date(),
      consecutiveFailures: working ? 0 : (this.getFailures(proxy.id) + 1),
    };

    this.healthMap.set(proxy.id, health);
    return health;
  }

  isProxyHealthy(proxyId: string): boolean {
    const health = this.healthMap.get(proxyId);
    if (!health) return true; // Assume healthy if never checked

    return health.working &&
           health.consecutiveFailures < 3 &&
           health.latency < 5000;
  }
}
```

### Ban Detection

```typescript
class BanDetector {
  private bannedProxies: Map<string, { retailer: string; until: Date }[]> = new Map();

  markAsBanned(proxyId: string, retailer: string, durationMs: number = 3600000) {
    const bans = this.bannedProxies.get(proxyId) || [];
    bans.push({
      retailer,
      until: new Date(Date.now() + durationMs),
    });
    this.bannedProxies.set(proxyId, bans);
  }

  isBannedFor(proxyId: string, retailer: string): boolean {
    const bans = this.bannedProxies.get(proxyId) || [];
    return bans.some(ban =>
      ban.retailer === retailer && ban.until > new Date()
    );
  }

  getAvailableProxy(retailer: string): ProxyConfig | null {
    for (const proxy of this.pool.getAll()) {
      if (!this.isBannedFor(proxy.id, retailer) && this.healthChecker.isProxyHealthy(proxy.id)) {
        return proxy;
      }
    }
    return null;
  }
}
```

## Proxy Configuration

### Environment Variables

```bash
# .env
PROXY_PROVIDER=brightdata
PROXY_USERNAME=your_username
PROXY_PASSWORD=your_password
PROXY_HOST=brd.superproxy.io
PROXY_PORT=22225

# Or for multiple proxies
PROXY_LIST_PATH=./config/proxies.json
```

### Config File Format

```json
{
  "proxies": [
    {
      "id": "res-1",
      "type": "residential",
      "host": "gate.smartproxy.com",
      "port": 7000,
      "username": "user",
      "password": "pass",
      "location": "US",
      "state": "NY"
    },
    {
      "id": "isp-1",
      "type": "isp",
      "host": "isp.oxylabs.io",
      "port": 8001,
      "username": "user",
      "password": "pass",
      "location": "US",
      "state": "VA",
      "static": true
    }
  ],
  "retailerPreferences": {
    "target": {
      "preferredType": "residential",
      "rotationStrategy": "sticky",
      "stickyDurationMs": 600000
    },
    "bestbuy": {
      "preferredType": "isp",
      "rotationStrategy": "static"
    }
  }
}
```

## Cost Optimization

### Bandwidth Usage Estimation

| Action | Est. Bandwidth |
|--------|----------------|
| Page load | 2-5 MB |
| Product check | 0.5-1 MB |
| Full checkout | 5-10 MB |
| Session (10 checks) | 10-15 MB |

### Cost Per Purchase Attempt

| Proxy Type | Cost/GB | Est. Cost/Attempt |
|------------|---------|-------------------|
| Residential | $8/GB | $0.08-0.12 |
| ISP | $15/IP/mo | ~$0.02 (amortized) |
| Datacenter | $0.50/GB | $0.005-0.01 |

### Optimization Strategies

1. **Use datacenter for monitoring** - Only switch to residential for checkout
2. **Cache static assets locally** - Reduce bandwidth on repeated visits
3. **Minimize page loads** - Use API endpoints where possible
4. **Session reuse** - Maintain cookies to avoid re-authentication

## Provider Integration Examples

### Bright Data

```typescript
const brightDataProxy = {
  server: 'http://brd.superproxy.io:22225',
  username: 'brd-customer-CUSTOMER_ID-zone-ZONE_NAME',
  password: 'ZONE_PASSWORD',
};

// With country targeting
const usProxy = {
  server: 'http://brd.superproxy.io:22225',
  username: 'brd-customer-CUSTOMER_ID-zone-ZONE_NAME-country-us',
  password: 'ZONE_PASSWORD',
};

// With state targeting
const nyProxy = {
  server: 'http://brd.superproxy.io:22225',
  username: 'brd-customer-CUSTOMER_ID-zone-ZONE_NAME-country-us-state-newyork',
  password: 'ZONE_PASSWORD',
};
```

### Oxylabs

```typescript
const oxylabsProxy = {
  server: 'http://pr.oxylabs.io:7777',
  username: 'customer-USERNAME-cc-US',
  password: 'PASSWORD',
};

// Sticky session
const stickyProxy = {
  server: 'http://pr.oxylabs.io:7777',
  username: 'customer-USERNAME-cc-US-sessid-SESSION_ID-sesstime-10',
  password: 'PASSWORD',
};
```

### Smartproxy

```typescript
const smartProxy = {
  server: 'http://gate.smartproxy.com:7000',
  username: 'USERNAME',
  password: 'PASSWORD',
};

// With geo targeting
const geoProxy = {
  server: 'http://us.smartproxy.com:10000',
  username: 'USERNAME',
  password: 'PASSWORD',
};
```

## Best Practices

1. **Match proxy location to account** - Shipping address should align with proxy state
2. **One account per IP** - For ISP/static proxies, dedicate to single account
3. **Monitor success rates** - Track which proxy types work best per retailer
4. **Rotate banned proxies out** - Automatic cooldown on failures
5. **Test before drops** - Verify proxy health before high-value attempts
6. **Have backup providers** - Don't rely on single proxy source

## Sources

- [Proxyway - Best Sneaker Proxies 2025](https://proxyway.com/best/sneaker-proxies)
- [KocerRoxy - Residential Proxies for Sneaker Bots](https://kocerroxy.com/blog/90-success-rate-residential-proxies-for-sneaker-bots/)
- [Oxylabs - Sneaker Proxies](https://oxylabs.io/products/sneaker-proxies)
- [ProxyEmpire - Best Proxies for Sneakers 2025](https://proxyempire.io/best-proxies-for-sneakers-in-2025/)
- [Tidal Market - Retail Botting Guide](https://www.tidalmarket.com/blog/retail-botting-guide)
