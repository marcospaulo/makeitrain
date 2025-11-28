# Make It Rain

Automated inventory purchasing bot for Target, Best Buy, Costco, Sam's Club, and other retailers.

## Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design and component overview
- **[ANTI-DETECTION.md](./ANTI-DETECTION.md)** - Stealth techniques and bot evasion
- **[PROXIES.md](./PROXIES.md)** - Proxy types, providers, and rotation strategies
- **[RETAILERS.md](./RETAILERS.md)** - Target, Best Buy, Costco, Sam's Club implementation
- **[FAST-CHECKOUT.md](./FAST-CHECKOUT.md)** - Speed optimization, direct cart URLs, API shortcuts
- **[COSTCO-DEEP-DIVE.md](./COSTCO-DEEP-DIVE.md)** - Costco-specific strategies for product drops
- **[DOCKER-MCP-ARCHITECTURE.md](./DOCKER-MCP-ARCHITECTURE.md)** - Docker + MCP + GCP deployment architecture
- **[ROADMAP.md](./ROADMAP.md)** - Implementation phases and tasks

## Tech Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript
- **Browser Automation:** Playwright + Stealth Plugin
- **AI Integration:** MCP (Model Context Protocol)
- **Proxies:** Residential/ISP (Bright Data, Oxylabs, Smartproxy)

## Quick Start

```bash
# Install dependencies
npm install

# Copy and edit environment config
cp .env.example .env
# Edit .env with your proxy credentials and Costco login

# Test browser stealth setup
npm run test:browser

# Run Costco stock monitor
npm run test:costco
```

## MCP Server (AI-Controlled Browser)

The bot includes an MCP server that allows Claude to control the browser:

```bash
# Run MCP server for Claude Desktop
npm run mcp
```

See [SETUP.md](./SETUP.md) for Claude Desktop configuration.

## Docker

```bash
# Build and run with Docker
docker-compose up -d

# View logs
docker-compose logs -f monitor
```

## Status

✅ **Ready to use** - Browser automation with MCP integration complete.

## Disclaimer

For personal use only. Respect retailer terms of service.
