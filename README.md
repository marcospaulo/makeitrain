# Make It Rain

Automated inventory purchasing bot for Target, Best Buy, Costco, Sam's Club, and other retailers.

## Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design and component overview
- **[ANTI-DETECTION.md](./ANTI-DETECTION.md)** - Stealth techniques and bot evasion
- **[PROXIES.md](./PROXIES.md)** - Proxy types, providers, and rotation strategies
- **[RETAILERS.md](./RETAILERS.md)** - Target, Best Buy, Costco, Sam's Club implementation
- **[FAST-CHECKOUT.md](./FAST-CHECKOUT.md)** - Speed optimization, direct cart URLs, API shortcuts
- **[ROADMAP.md](./ROADMAP.md)** - Implementation phases and tasks

## Tech Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript
- **Browser Automation:** Playwright + Stealth Plugin
- **Proxies:** Residential/ISP (Bright Data, Oxylabs, etc.)

## Quick Start

```bash
# Install dependencies
npm install

# Run stealth test
npx tsx test-stealth.ts
```

## Status

Planning phase - see [ROADMAP.md](./ROADMAP.md) for implementation details.

## Disclaimer

For personal use only. Respect retailer terms of service.
