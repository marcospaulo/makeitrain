# Fast Checkout Optimization Guide

## Overview

Speed is everything in automated purchasing. The difference between success and failure often comes down to milliseconds. This guide covers techniques to minimize checkout time, from direct cart URLs to API-based approaches.

## Speed Comparison: Browser vs API

| Approach | Checkout Time | Detection Risk | Complexity |
|----------|---------------|----------------|------------|
| **Full Browser Automation** | 5-10 seconds | Lower | Low |
| **Optimized Browser** | 2-5 seconds | Lower | Medium |
| **Hybrid (Browser + API)** | 1-3 seconds | Medium | Medium |
| **Pure API/Request-Based** | 0.3-1 seconds | Higher | High |

**Key Insight:** Request-based bots are 10-20x faster than browser automation, but detection risk is higher. The best approach often combines both.

---

## Direct Add-to-Cart URLs

### Best Buy (Official API)

Best Buy offers the most robust direct cart functionality through their API:

```typescript
// Direct add to cart URL format
const addToCartUrl = `https://api.bestbuy.com/click/-/${skuId}/cart`;

// With affiliate tracking
const affiliateUrl = `https://api.bestbuy.com/click/${partnerId}/${skuId}/cart`;

// Example: Add SKU 6428324 to cart
const url = 'https://api.bestbuy.com/click/-/6428324/cart';

// Multiple items (open in sequence)
const skus = ['6428324', '6430163', '6430161'];
for (const sku of skus) {
  window.open(`https://api.bestbuy.com/click/-/${sku}/cart`);
}
```

**Usage in Automation:**

```typescript
async function bestBuyDirectCart(page: Page, sku: string): Promise<boolean> {
  // Skip product page entirely - go direct to cart URL
  await page.goto(`https://api.bestbuy.com/click/-/${sku}/cart`);

  // Wait for redirect to complete
  await page.waitForURL('**/cart**', { timeout: 10000 });

  // Verify item in cart
  const cartItems = await page.$$('.cart-item');
  return cartItems.length > 0;
}
```

### Target

Target does NOT have public direct cart URLs. Must use browser automation:

```typescript
// No shortcut available - must go through product page
// However, you can pre-construct the URL with parameters

const targetProductUrl = (tcin: string, storeId?: string) => {
  let url = `https://www.target.com/p/-/A-${tcin}`;
  if (storeId) {
    url += `?storeId=${storeId}`;
  }
  return url;
};
```

### Amazon (One-Click)

Amazon's 1-Click requires browser automation but can be triggered directly:

```typescript
async function amazonOneClick(page: Page, asin: string): Promise<boolean> {
  // Navigate directly to product with 1-click visible
  await page.goto(`https://www.amazon.com/dp/${asin}`);

  // Look for 1-click button
  const oneClickBtn = await page.$('#one-click-button, #buy-now-button');

  if (oneClickBtn) {
    await oneClickBtn.click();
    // 1-click completes purchase immediately!
    return true;
  }

  return false;
}
```

### Walmart

Walmart has an add-to-cart API endpoint (requires session):

```typescript
// Walmart cart API (requires valid session cookies)
const walmartAddToCart = async (itemId: string, quantity: number = 1) => {
  const response = await fetch('https://www.walmart.com/api/v3/cart/guest/:CID/items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Requires valid session cookies
    },
    body: JSON.stringify({
      itemId,
      quantity,
      isPreOrder: false,
    }),
  });

  return response.ok;
};
```

---

## Headless Browser Optimization

### Can You Use Headless Mode?

**2025 Reality:** Pure headless mode is heavily detected. However, there are workarounds:

| Mode | Speed | Detection | Recommendation |
|------|-------|-----------|----------------|
| Headed (`headless: false`) | Slower | Low | Best for checkout |
| Headless (`headless: true`) | Faster | Very High | Avoid |
| New Headless (`headless: 'new'`) | Faster | High | Risky |
| Virtual Framebuffer (Xvfb) | Medium | Medium | Good compromise |

### Xvfb for "Headless" Speed with Headed Stealth

```bash
# Install Xvfb (Linux)
apt-get install xvfb

# Run Playwright with virtual display
xvfb-run --auto-servernum --server-args='-screen 0 1920x1080x24' node bot.js
```

```typescript
// Launch configuration for Xvfb
const browser = await chromium.launch({
  headless: false, // Actually runs headed, but in virtual display
  args: [
    '--disable-blink-features=AutomationControlled',
    '--window-size=1920,1080',
  ],
});
```

### Resource Blocking for Speed

Block unnecessary resources to speed up page loads:

```typescript
async function setupResourceBlocking(page: Page) {
  await page.route('**/*', (route) => {
    const resourceType = route.request().resourceType();
    const url = route.request().url();

    // Block heavy resources
    if (['image', 'font', 'media'].includes(resourceType)) {
      return route.abort();
    }

    // Block analytics/tracking
    if (url.includes('google-analytics') ||
        url.includes('facebook') ||
        url.includes('doubleclick') ||
        url.includes('hotjar')) {
      return route.abort();
    }

    return route.continue();
  });
}

// Usage
const page = await context.newPage();
await setupResourceBlocking(page);
// Page loads 2-3x faster without images/fonts
```

### Selective Resource Loading

For checkout, you need some resources. Be selective:

```typescript
async function setupCheckoutOptimization(page: Page) {
  await page.route('**/*', (route) => {
    const resourceType = route.request().resourceType();
    const url = route.request().url();

    // Block images except payment provider logos
    if (resourceType === 'image') {
      if (url.includes('visa') || url.includes('mastercard') || url.includes('paypal')) {
        return route.continue();
      }
      return route.abort();
    }

    // Block fonts (text still readable)
    if (resourceType === 'font') {
      return route.abort();
    }

    // Block third-party scripts except payment
    if (resourceType === 'script') {
      if (url.includes('stripe') || url.includes('paypal') || url.includes('checkout')) {
        return route.continue();
      }
      if (!url.includes(page.url().split('/')[2])) {
        return route.abort(); // Block third-party
      }
    }

    return route.continue();
  });
}
```

---

## API-Based Fast Checkout

### Intercepting and Replaying Requests

The fastest approach: intercept browser requests, then replay via HTTP:

```typescript
// Step 1: Record requests during manual checkout
async function recordCheckoutRequests(page: Page) {
  const requests: RequestData[] = [];

  page.on('request', (request) => {
    if (request.url().includes('/cart') || request.url().includes('/checkout')) {
      requests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData(),
      });
    }
  });

  // Perform manual checkout...
  // Save requests for analysis
  return requests;
}

// Step 2: Replay via HTTP (much faster)
async function replayCheckout(sessionCookies: string, checkoutData: CheckoutData) {
  // Add to cart via API
  const cartResponse = await fetch('https://retailer.com/api/cart/add', {
    method: 'POST',
    headers: {
      'Cookie': sessionCookies,
      'Content-Type': 'application/json',
      // Copy other required headers from recording
    },
    body: JSON.stringify({
      itemId: checkoutData.itemId,
      quantity: 1,
    }),
  });

  // Checkout via API
  const checkoutResponse = await fetch('https://retailer.com/api/checkout', {
    method: 'POST',
    headers: {
      'Cookie': sessionCookies,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      paymentMethodId: checkoutData.paymentId,
      shippingAddressId: checkoutData.addressId,
    }),
  });

  return checkoutResponse.ok;
}
```

### Hybrid Approach (Recommended)

Use browser for login/session, API for speed-critical operations:

```typescript
class HybridCheckout {
  private sessionCookies: string = '';
  private csrfToken: string = '';

  async initialize(page: Page, account: AccountConfig) {
    // Use browser for login (handles anti-bot)
    await this.browserLogin(page, account);

    // Extract session for API use
    const cookies = await page.context().cookies();
    this.sessionCookies = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // Get CSRF token if needed
    this.csrfToken = await page.evaluate(() => {
      return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    });
  }

  async fastAddToCart(sku: string): Promise<boolean> {
    // Use API for speed
    const response = await fetch(`https://retailer.com/api/cart/add`, {
      method: 'POST',
      headers: {
        'Cookie': this.sessionCookies,
        'X-CSRF-Token': this.csrfToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sku, quantity: 1 }),
    });

    return response.ok;
  }

  async fastCheckout(page: Page): Promise<boolean> {
    // Switch back to browser for checkout (more reliable)
    await page.goto('https://retailer.com/checkout');
    // ... complete checkout in browser
  }
}
```

---

## Pre-Loading & Session Warming

### Keep Sessions Hot

```typescript
class SessionWarmer {
  private intervals: Map<string, NodeJS.Timer> = new Map();

  startWarming(page: Page, retailer: string) {
    const interval = setInterval(async () => {
      // Lightweight request to keep session alive
      await page.evaluate(() => {
        fetch('/api/session/ping', { credentials: 'include' });
      });
    }, 60000); // Every minute

    this.intervals.set(retailer, interval);
  }

  stopWarming(retailer: string) {
    const interval = this.intervals.get(retailer);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(retailer);
    }
  }
}
```

### Pre-Position at Checkout

```typescript
async function prePositionForDrop(page: Page, productUrl: string) {
  // Add a placeholder item to cart first
  await addPlaceholderToCart(page);

  // Navigate to checkout page
  await page.goto('https://retailer.com/checkout');

  // Fill in all details
  await fillShippingIfNeeded(page);
  await selectPaymentMethod(page);

  // Now wait here - when drop happens:
  // 1. Quick API call to swap cart item
  // 2. Click "Place Order" (already on checkout page!)
}
```

---

## Button Color Monitoring (Best Buy Style)

The BestBuy GPU Bot approach - monitor for button state changes:

```typescript
async function monitorButtonState(page: Page, productUrl: string) {
  await page.goto(productUrl);

  // Set up mutation observer for button changes
  await page.evaluate(() => {
    const button = document.querySelector('.add-to-cart-button');
    if (!button) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const classes = (mutation.target as Element).className;
          if (!classes.includes('btn-disabled')) {
            // Button became active!
            (window as any).buttonActive = true;
          }
        }
      });
    });

    observer.observe(button, { attributes: true });
  });

  // Poll for state change
  while (true) {
    const isActive = await page.evaluate(() => (window as any).buttonActive);
    if (isActive) {
      // Immediately click!
      await page.click('.add-to-cart-button');
      return true;
    }
    await page.waitForTimeout(100); // Check every 100ms
  }
}
```

---

## Multi-Tab / Multi-Instance Strategy

### Parallel Attempts

```typescript
async function parallelCheckout(browser: Browser, sku: string, attempts: number = 3) {
  const pages = await Promise.all(
    Array(attempts).fill(null).map(() => browser.newPage())
  );

  // Race all attempts
  const results = await Promise.race(
    pages.map(async (page, index) => {
      try {
        const success = await attemptCheckout(page, sku);
        if (success) {
          // Cancel other attempts
          pages.forEach((p, i) => i !== index && p.close());
          return { success: true, page };
        }
      } catch (error) {
        console.log(`Attempt ${index} failed: ${error.message}`);
      }
      return { success: false };
    })
  );

  return results;
}
```

### Tab Recycling (Memory Optimization)

```typescript
class TabRecycler {
  private page: Page | null = null;
  private browser: Browser;

  constructor(browser: Browser) {
    this.browser = browser;
  }

  async getPage(): Promise<Page> {
    if (this.page) {
      // Recycle existing tab - clear state
      await this.page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await this.page.goto('about:blank');
      return this.page;
    }

    this.page = await this.browser.newPage();
    return this.page;
  }

  async recyclePage() {
    if (this.page) {
      // Close and reopen for clean slate
      await this.page.close();
      this.page = await this.browser.newPage();
    }
  }
}
```

---

## Speed Benchmarks by Retailer

### Realistic Checkout Times (Optimized)

| Retailer | Browser Only | With Direct Cart | Hybrid API | Notes |
|----------|--------------|------------------|------------|-------|
| **Best Buy** | 8-15s | 3-5s | 2-3s | Direct cart URL helps |
| **Target** | 6-12s | N/A | 3-5s | No direct cart, API possible |
| **Costco** | 10-20s | N/A | N/A | Akamai blocks API attempts |
| **Sam's Club** | 6-10s | N/A | 4-6s | Walmart-style APIs |
| **Amazon** | 3-5s (1-click) | N/A | 1-2s | 1-click is already fast |
| **Walmart** | 5-10s | N/A | 2-4s | Has cart API |

---

## Implementation Checklist

### Speed Optimization Checklist

- [ ] Block images, fonts, analytics in browser
- [ ] Use direct cart URLs where available (Best Buy)
- [ ] Pre-fill all account/payment info
- [ ] Keep sessions warm with periodic pings
- [ ] Use Xvfb for headed speed without display
- [ ] Implement request interception for API discovery
- [ ] Build hybrid browser+API approach
- [ ] Set up parallel multi-tab attempts
- [ ] Monitor button states instead of full page reloads
- [ ] Pre-position at checkout before drops

### Test Your Speed

```typescript
async function benchmarkCheckout(page: Page, retailer: RetailerModule) {
  const start = Date.now();

  await retailer.login(page, testAccount);
  const loginTime = Date.now() - start;

  const cartStart = Date.now();
  await retailer.addToCart(page, testProduct);
  const cartTime = Date.now() - cartStart;

  const checkoutStart = Date.now();
  await retailer.checkout(page, testAccount);
  const checkoutTime = Date.now() - checkoutStart;

  console.log(`
    Login: ${loginTime}ms
    Add to Cart: ${cartTime}ms
    Checkout: ${checkoutTime}ms
    Total: ${Date.now() - start}ms
  `);
}
```

---

## Sources

- [Best Buy Developer API](https://bestbuyapis.github.io/api-documentation/)
- [GitHub - BestBuy GPU Bot](https://github.com/kkapuria3/BestBuy-GPU-Bot)
- [GitHub - Target Checkout Bot](https://github.com/flclxo/target-checkout-bot)
- [Medium - How to Make a Sneaker Bot](https://medium.com/@ad_68974/how-to-make-a-sneaker-bot-full-guide-68b3e17d4a2c)
- [Multilogin - Antidetect Browsers for Sneaker Bots](https://multilogin.com/blog/antidetect-browsers-for-sneaker-copping-bots/)
- [Marketing Scoop - Complete Guide to Sneaker Bots 2025](https://www.marketingscoop.com/small-business/sneaker-bots/)
- [Bright Data - Browser Automation Tools 2025](https://brightdata.com/blog/web-data/best-browser-automation-tools)
- [Latenode - Headless Browser Detection Bypass](https://latenode.com/blog/web-automation-scraping/avoiding-bot-detection/how-headless-browser-detection-works-and-how-to-bypass-it)
- [ScrapeOps - Bypass Anti-Bots 2025](https://scrapeops.io/web-scraping-playbook/how-to-bypass-antibots/)
