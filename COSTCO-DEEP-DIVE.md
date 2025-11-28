# Costco Deep Dive - Drop Day Strategy Guide

## The Challenge

Costco uses **Akamai Bot Manager** - one of the most sophisticated bot protection systems. Key facts:

- Standard Playwright/Puppeteer/Selenium gets **401 Unauthorized** immediately
- Even with stealth plugins, Akamai detects automation at the TLS handshake level
- Costco drops often sell out in **4 minutes or less**
- No public add-to-cart URLs or checkout APIs available

## Your Options (Ranked by Feasibility)

### Option 1: Manual Speed Optimization (RECOMMENDED FOR TOMORROW)

Since automation is extremely difficult with Costco, your best bet for tomorrow is optimized manual checkout.

#### Pre-Drop Preparation Checklist

```
□ Log into Costco.com NOW (don't wait until tomorrow)
□ Save your default payment method (Account → Payment Methods)
□ Save your default shipping address (Account → Address Book)
□ Enable Express Checkout (one-click for saved info)
□ Install browser autofill extension (Kudos, LastPass, etc.)
□ Bookmark the product page (if URL is known)
□ Set up stock alerts (Visualping, RestockBee)
□ Have Costco app installed with digital card ready
□ Use wired internet connection (faster than WiFi)
□ Close unnecessary browser tabs/apps
```

#### Express Checkout Setup

1. Go to **My Account → Payment Methods** → Add default card
2. Go to **My Account → Address Book** → Set default shipping
3. When item drops, Express Checkout skips forms entirely

#### Speed Tips During Drop

```
1. DON'T refresh obsessively - it can trigger rate limits
2. Keep trying checkout even if errors appear
3. Have multiple browser tabs open to the product page
4. Use keyboard shortcuts (Tab, Enter) instead of mouse
5. Have CVV memorized (you'll need to type it)
6. If cart errors, DON'T clear cart - keep retrying
```

### Option 2: Chrome Extension Bot ($79.99)

**Most Advanced Bot - Costco Bot**: A commercial solution that works.

**Features:**
- Auto add-to-cart when stock detected
- Keyword search on collection pages
- Multi-Chrome profile support
- Works on costco.com and costco.ca
- Auto-refresh with randomized intervals

**How it works:**
- Runs as Chrome extension (not headless - avoids Akamai)
- Uses your real logged-in session
- You must pre-save payment/address info
- Can handle CAPTCHA checkboxes (image CAPTCHAs need manual solve)

**Setup:**
1. Purchase from mostadvancedbot.com ($79.99)
2. Login to Costco in Chrome
3. Configure product keywords or collection page URL
4. Set refresh interval
5. Start monitoring before drop time

**Limitations:**
- Not guaranteed success
- May require manual CAPTCHA solving
- One-time purchase, lifetime updates

### Option 3: DIY Monitoring + Fast Manual Checkout

Use automation for **monitoring only**, then checkout manually.

#### Stock Monitor Setup

**Visualping (Free tier available):**
```
1. Go to visualping.io
2. Paste Costco product URL
3. Select the "Add to Cart" or stock status area
4. Set check interval to 5 minutes (or 1 min on paid)
5. Enable SMS + email alerts
```

**GitHub Costco Inventory Checker:**
```bash
git clone https://github.com/tonyranieri/costco-inventory-checker
cd costco-inventory-checker/src
npm install

# Edit costco-config.js with your item numbers
# Edit .env with your location and email settings

npm start
```

**RestockBee:**
- Go to restockbee.com
- Paste product URL
- Get free email notification when in stock

#### When Alert Fires
1. Immediately click notification/bookmark
2. Add to cart (hopefully button is active)
3. Use Express Checkout
4. Enter CVV only
5. Place order

### Option 4: Anti-Detect Browser + Automation (Advanced)

For persistent automation that *might* work against Akamai.

#### Required Components

| Component | Cost | Purpose |
|-----------|------|---------|
| **Kameleo or Multilogin** | $59-89/mo | Real browser fingerprints |
| **Residential Proxies** | $8-15/GB | Clean IPs |
| **Your own browser profile** | Free | Pre-authenticated session |

#### Kameleo Setup

```javascript
// Kameleo with Playwright
const { KameleoLocalApiClient } = require('@anthropic/kameleo-local-api-client');

const client = new KameleoLocalApiClient();

// Create profile with real fingerprint
const profile = await client.createProfile({
  deviceType: 'desktop',
  os: 'windows',
  browser: 'chrome',
});

// Connect Playwright to Kameleo browser
const browserWSEndpoint = `ws://localhost:${profile.commandPort}/devtools/browser/${profile.id}`;
const browser = await chromium.connectOverCDP(browserWSEndpoint);

// Now use normally - appears as real browser
const page = await browser.newPage();
await page.goto('https://www.costco.com');
```

#### Why This Might Work

- Kameleo uses **real browser fingerprints** from actual devices
- TLS fingerprint matches legitimate Chrome/Firefox
- Combined with residential proxy, IP looks legitimate
- Pre-warm session by browsing normally first

#### Why It Might Not Work

- Akamai also checks behavioral patterns
- Cookie/session anomalies can still trigger blocks
- Expensive setup for uncertain results

### Option 5: Scrapy-Impersonate for Monitoring (Technical)

For developers - use Python to monitor stock without browser.

```python
import scrapy
from scrapy_impersonate import ImpersonateSpider

class CostcoMonitor(ImpersonateSpider):
    name = 'costco_monitor'

    custom_settings = {
        "DOWNLOAD_HANDLERS": {
            "http": "scrapy_impersonate.ImpersonateDownloadHandler",
            "https": "scrapy_impersonate.ImpersonateDownloadHandler",
        },
        "TWISTED_REACTOR": "twisted.internet.asyncioreactor.AsyncioSelectorReactor",
    }

    def start_requests(self):
        yield scrapy.Request(
            url='https://www.costco.com/your-product.html',
            meta={'impersonate': 'chrome120'},
            callback=self.parse
        )

    def parse(self, response):
        # Check if "Add to Cart" button is present
        add_to_cart = response.css('button#add-to-cart-btn:not([disabled])')

        if add_to_cart:
            # ALERT! Item in stock!
            self.send_notification()
```

**Success Rate:** ~90% for monitoring, but checkout still needs browser.

---

## For Tomorrow's Drop - Action Plan

### Night Before

1. **Login to Costco.com** in your browser
2. **Save payment method** with correct billing address
3. **Save shipping address** as default
4. **Test Express Checkout** with a cheap in-stock item (cancel before placing)
5. **Set up Visualping** on the product page (if URL known)
6. **Install Costco app** on phone as backup
7. **Charge phone/laptop** fully
8. **Set alarm** for 15 min before expected drop time

### Drop Day Morning

```
T-15 min: Open Costco.com, verify logged in
T-10 min: Open product page (or category page)
T-5 min:  Clear browser cache (Ctrl+Shift+Delete)
T-2 min:  Position cursor near "Add to Cart" area
T-0:      Refresh page, look for button change
          Click Add to Cart immediately
          Go to cart → Checkout
          Enter CVV → Place Order
```

### If Using Commercial Bot

```
T-30 min: Start bot with conservative refresh (10-15 sec)
T-15 min: Increase refresh rate (5-7 sec)
T-5 min:  Monitor bot status
T-0:      Watch for auto-cart notification
          Complete checkout (may be auto or manual)
```

### Backup Strategies

1. **Multiple devices** - Phone app + Computer browser
2. **Multiple browsers** - Chrome + Firefox + Safari
3. **Partner help** - Have someone else also try
4. **Costco Business Center** - Sometimes has stock when .com doesn't

---

## Costco-Specific Technical Details

### API Endpoints (Internal - Protected by Akamai)

```
Product Search: /www_costco_com_search?expoption=...
Add to Cart:    Protected - no direct URL
Checkout:       Protected - no direct URL
Inventory:      Protected - must use browser
```

### Session Requirements

- Must be logged in (membership required)
- Cookies include Akamai sensor data
- Session timeout: ~30 minutes inactive
- Cookie refresh: Automatic during browsing

### Known Drop Patterns

- **Electronics:** Often early morning (6-9 AM PST)
- **Limited items:** May drop without warning (2025 change)
- **Restocks:** Can happen multiple times per day
- **Weekdays:** More common than weekends

---

## Sources

- [Most Advanced Bot - Costco Bot](https://mostadvancedbot.com/products/p/costco-bot)
- [GitHub - CostcoAutobuyExtension](https://github.com/guyuli/CostcoAutobuyExtension)
- [GitHub - costco-inventory-checker](https://github.com/tonyranieri/costco-inventory-checker)
- [Visualping - Costco In-Stock Alerts](https://visualping.io/blog/costco-in-stock-alerts)
- [Scrapfly - How to Bypass Akamai](https://scrapfly.io/blog/posts/how-to-bypass-akamai-anti-scraping)
- [ZenRows - Bypass Akamai 2025](https://www.zenrows.com/blog/bypass-akamai)
- [The Web Scraping Club - Bypassing Akamai for Free](https://substack.thewebscraping.club/p/bypassing-akamai-for-free)
- [Unwrangle - How to Scrape Costco 2025](https://www.unwrangle.com/blog/how-to-scrape-costco/)
- [Costco Express Checkout](https://www.costco.com/express-checkout-info.html)
- [Kameleo - Anti-Detect Browser](https://kameleo.io/)
- [Multilogin - Anti-Detect Browser](https://multilogin.com/)
