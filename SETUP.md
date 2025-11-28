# Setup Guide - Make It Rain

## Quick Start (Tonight!)

### 1. Get a Residential Proxy

Sign up for one of these (cheapest first):

| Provider | Trial Cost | Link |
|----------|------------|------|
| **Smartproxy** | $12.50/1GB | https://smartproxy.com |
| **Bright Data** | Free trial | https://brightdata.com |
| **Oxylabs** | $15/1GB | https://oxylabs.io |

After signup, get your credentials:
- Host (e.g., `gate.smartproxy.com`)
- Port (e.g., `7000`)
- Username
- Password

### 2. Configure Environment

```bash
# Copy example env
cp .env.example .env

# Edit with your credentials
nano .env
```

Fill in:
```
PROXY_HOST=gate.smartproxy.com
PROXY_PORT=7000
PROXY_USER=your_username
PROXY_PASS=your_password

COSTCO_EMAIL=your_costco_email@gmail.com
COSTCO_PASSWORD=your_costco_password

TARGET_URL=https://www.costco.com/your-product-page.html
```

### 3. Test Browser Setup

```bash
# Run browser test (will open a visible browser)
npm run test:browser
```

This will:
1. Test bot detection evasion
2. Check your proxy IP
3. Test Costco homepage access

If Costco loads without "Access Denied" - you're ready!

### 4. Run Stock Monitor

```bash
# Start monitoring (will auto-checkout when in stock)
npm run test:costco
```

The monitor will:
1. Log into your Costco account
2. Check the product page every 30 seconds
3. Alert you (Discord optional) when in stock
4. Attempt to add to cart and checkout
5. Stop before placing order (manual confirmation)

---

## Using with Claude (MCP)

### Option A: Claude Desktop

1. Open Claude Desktop settings
2. Edit `claude_desktop_config.json`
3. Add the browser-automation server:

```json
{
  "mcpServers": {
    "browser-automation": {
      "command": "npx",
      "args": ["tsx", "/PATH/TO/make-it-rain/src/mcp/server.ts"],
      "env": {
        "PROXY_HOST": "gate.smartproxy.com",
        "PROXY_PORT": "7000",
        "PROXY_USER": "YOUR_USERNAME",
        "PROXY_PASS": "YOUR_PASSWORD"
      }
    }
  }
}
```

4. Restart Claude Desktop
5. Claude can now control the browser!

### Example Claude Prompts

```
"Launch the browser with the configured proxy"

"Navigate to https://www.costco.com and take a screenshot"

"Login to Costco with email X and password Y"

"Go to [product URL] and check if the Add to Cart button is available"

"Click the Add to Cart button"

"Go to the cart and proceed to checkout"

"Take a screenshot so I can see the current page"
```

### Option B: Claude Code (This Session)

If you're using Claude Code, I can directly help you:

1. First, create your `.env` file with proxy credentials
2. Tell me "test the browser"
3. I'll launch it and we can work together to:
   - Login to Costco
   - Navigate to the product
   - Monitor for stock
   - Complete checkout when available

---

## Docker Deployment

### Build and Run

```bash
# Build the image
docker build -t makeitrain .

# Run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f monitor
```

### Connect VNC for Debugging

If `ENABLE_VNC=true`:
```bash
# Connect with any VNC viewer
open vnc://localhost:5900
```

---

## Troubleshooting

### "Access Denied" on Costco

Your proxy is being blocked. Try:
1. Different proxy provider
2. Different proxy location (try US states: CA, NY, TX)
3. Use sticky sessions instead of rotating

### Bot Detection Failing

Check `./screenshots/test-sannysoft.png` after running `test:browser`.
- All green = good
- Red items = still detectable

Common fixes:
- Use headed mode (`headless: false`)
- Add more random delays
- Use residential proxy (not datacenter)

### CAPTCHA Appearing

Costco shows CAPTCHA when suspicious. Options:
1. Slow down (increase delays)
2. Warm up session (browse normally first)
3. Use saved cookies from manual login
4. Manual intervention when CAPTCHA appears

### Login Failing

1. Check credentials in `.env`
2. Try logging in manually first, save cookies
3. Some accounts may have 2FA - disable or handle manually

---

## File Structure

```
make-it-rain/
├── src/
│   ├── browser/
│   │   ├── launcher.ts     # Browser launch with stealth
│   │   └── human.ts        # Human-like behavior simulation
│   ├── mcp/
│   │   └── server.ts       # MCP server for AI control
│   ├── test-browser.ts     # Browser/proxy test
│   └── test-costco.ts      # Costco monitor script
├── screenshots/            # Screenshots saved here
├── data/cookies/           # Saved sessions
├── .env                    # Your configuration
├── docker-compose.yml      # Docker setup
└── Dockerfile              # Container definition
```

---

## Cost Breakdown

| Item | Cost |
|------|------|
| Residential proxy (1GB) | $10-15 |
| Total for tonight | **~$15** |

Most checkout attempts use 10-50MB of bandwidth.
1GB should be enough for hundreds of attempts.

---

## Next Steps for Tomorrow's Drop

1. ✅ Set up proxy and test browser access
2. ✅ Login to Costco and save session
3. ✅ Configure TARGET_URL with product page
4. ✅ Start monitor before expected drop time
5. ✅ Watch for "IN STOCK" notification
6. ✅ Complete checkout when prompted

Good luck! 🎯
