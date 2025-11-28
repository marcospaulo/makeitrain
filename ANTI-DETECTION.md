# Anti-Detection & Stealth Techniques

## Overview

Modern retailers employ sophisticated bot detection systems. This document covers the techniques needed to evade detection while automating browser interactions.

## Detection Vectors

### 1. Browser Fingerprinting

Websites collect dozens of data points to create a unique browser "fingerprint":

| Category | Data Points |
|----------|-------------|
| **Navigator** | userAgent, platform, language, plugins, webdriver flag |
| **Screen** | resolution, color depth, device pixel ratio |
| **WebGL** | renderer, vendor, extensions |
| **Canvas** | rendering patterns (unique per GPU/driver) |
| **Audio** | AudioContext fingerprint |
| **Fonts** | installed system fonts |
| **Hardware** | CPU cores, device memory, touchpoints |

### 2. Behavioral Analysis

- Mouse movement patterns (bots move in straight lines)
- Typing speed and rhythm
- Scroll behavior
- Click timing and position
- Navigation patterns
- Time spent on pages

### 3. Network Signals

- IP reputation (datacenter vs residential)
- TLS fingerprint (JA3/JA4)
- HTTP/2 fingerprint
- Request timing patterns
- Geographic consistency

### 4. CDP Detection (2025 Focus)

Chrome DevTools Protocol (CDP) is used by Playwright, Puppeteer, and Selenium. Detection methods:

- Checking for CDP-specific JavaScript properties
- Analyzing runtime.enable calls
- Detecting injected scripts
- Monitoring debugger attachment

## Stealth Implementation

### Core Setup

```typescript
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Apply stealth plugin
chromium.use(StealthPlugin());

const browser = await chromium.launch({
  headless: false, // Headless mode is more detectable
  args: [
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--disable-extensions',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-infobars',
    '--window-size=1920,1080',
    '--start-maximized',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--enable-webgl',
    '--use-gl=swiftshader',
  ],
});
```

### Browser Context Configuration

```typescript
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  locale: 'en-US',
  timezoneId: 'America/New_York',
  geolocation: { latitude: 40.7128, longitude: -74.0060 },
  permissions: ['geolocation'],
  colorScheme: 'light',
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: false,
});
```

### Removing Webdriver Flag

```typescript
await page.addInitScript(() => {
  // Remove webdriver property
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
  });

  // Overwrite plugins to appear normal
  Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5],
  });

  // Overwrite languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
  });

  // Remove chrome automation indicators
  window.chrome = {
    runtime: {},
  };
});
```

### CDP Detection Evasion

```typescript
// Patch CDP detection
await page.addInitScript(() => {
  // Hide CDP artifacts
  delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
  delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
  delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
});
```

## Human Behavior Simulation

### Mouse Movement

```typescript
async function humanMouseMove(page: Page, x: number, y: number) {
  const steps = Math.floor(Math.random() * 20) + 10;
  const currentPosition = await page.evaluate(() => ({
    x: window.mouseX || 0,
    y: window.mouseY || 0,
  }));

  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    // Bezier curve for natural movement
    const easeProgress = progress * progress * (3 - 2 * progress);

    const newX = currentPosition.x + (x - currentPosition.x) * easeProgress;
    const newY = currentPosition.y + (y - currentPosition.y) * easeProgress;

    // Add slight randomness
    const jitterX = (Math.random() - 0.5) * 2;
    const jitterY = (Math.random() - 0.5) * 2;

    await page.mouse.move(newX + jitterX, newY + jitterY);
    await randomDelay(5, 15);
  }
}
```

### Typing Simulation

```typescript
async function humanType(page: Page, selector: string, text: string) {
  await page.click(selector);
  await randomDelay(50, 150);

  for (const char of text) {
    await page.keyboard.type(char);
    // Variable typing speed
    const delay = Math.floor(Math.random() * 100) + 30;
    await page.waitForTimeout(delay);

    // Occasional longer pauses (thinking)
    if (Math.random() < 0.05) {
      await randomDelay(200, 500);
    }
  }
}
```

### Scroll Behavior

```typescript
async function humanScroll(page: Page, targetY: number) {
  const currentY = await page.evaluate(() => window.scrollY);
  const distance = targetY - currentY;
  const steps = Math.abs(distance / 100);

  for (let i = 0; i < steps; i++) {
    const scrollAmount = distance / steps + (Math.random() - 0.5) * 20;
    await page.evaluate((amount) => {
      window.scrollBy({ top: amount, behavior: 'smooth' });
    }, scrollAmount);
    await randomDelay(50, 150);
  }
}
```

### Random Delays

```typescript
async function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Action-specific delays
const DELAYS = {
  pageLoad: { min: 1000, max: 3000 },
  beforeClick: { min: 100, max: 300 },
  afterClick: { min: 200, max: 500 },
  beforeType: { min: 50, max: 150 },
  betweenPages: { min: 500, max: 1500 },
  checkout: { min: 1000, max: 2000 },
};
```

## Fingerprint Management

### Using playwright-with-fingerprints

```typescript
import { plugin } from 'playwright-with-fingerprints';

// Get a fingerprint
const fingerprint = await plugin.fetch('chrome', {
  tags: ['Desktop', 'Windows'],
});

// Apply fingerprint
plugin.useFingerprint(fingerprint);

const browser = await plugin.launch();
```

### Consistent Fingerprint per Account

```typescript
interface AccountFingerprint {
  accountId: string;
  userAgent: string;
  viewport: { width: number; height: number };
  timezone: string;
  locale: string;
  platform: string;
}

function generateConsistentFingerprint(accountId: string): AccountFingerprint {
  // Use account ID as seed for deterministic fingerprint
  const hash = hashString(accountId);

  const viewports = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
  ];

  return {
    accountId,
    userAgent: generateUserAgent(hash),
    viewport: viewports[hash % viewports.length],
    timezone: 'America/New_York',
    locale: 'en-US',
    platform: 'Win32',
  };
}
```

## CAPTCHA Handling

### Detection

```typescript
async function detectCaptcha(page: Page): Promise<CaptchaType | null> {
  const captchaSelectors = {
    recaptcha: 'iframe[src*="recaptcha"]',
    hcaptcha: 'iframe[src*="hcaptcha"]',
    funcaptcha: 'iframe[src*="funcaptcha"]',
    perimeter: '#px-captcha',
  };

  for (const [type, selector] of Object.entries(captchaSelectors)) {
    if (await page.$(selector)) {
      return type as CaptchaType;
    }
  }
  return null;
}
```

### Solving Options

1. **Manual Intervention**: Pause and alert user
2. **2Captcha/Anti-Captcha Services**: API-based solving
3. **Capsolver**: Newer service with better rates

```typescript
async function solveCaptcha(page: Page, type: CaptchaType): Promise<boolean> {
  const solver = new CaptchaSolver(process.env.CAPTCHA_API_KEY);

  if (type === 'recaptcha') {
    const siteKey = await page.$eval(
      '.g-recaptcha',
      el => el.getAttribute('data-sitekey')
    );
    const token = await solver.solveRecaptcha(page.url(), siteKey);
    await page.evaluate((token) => {
      document.querySelector('#g-recaptcha-response').value = token;
    }, token);
    return true;
  }

  return false;
}
```

## Session Management

### Cookie Persistence

```typescript
async function saveCookies(context: BrowserContext, accountId: string) {
  const cookies = await context.cookies();
  const cookiePath = `./data/cookies/${accountId}.json`;
  await fs.writeFile(cookiePath, JSON.stringify(cookies, null, 2));
}

async function loadCookies(context: BrowserContext, accountId: string) {
  const cookiePath = `./data/cookies/${accountId}.json`;
  try {
    const cookies = JSON.parse(await fs.readFile(cookiePath, 'utf-8'));
    await context.addCookies(cookies);
    return true;
  } catch {
    return false;
  }
}
```

### Session Warmup

```typescript
async function warmupSession(page: Page, retailer: RetailerModule) {
  // Visit homepage first
  await page.goto(retailer.baseUrl);
  await randomDelay(2000, 4000);

  // Browse a few random products
  const randomProducts = await retailer.getRandomProducts(3);
  for (const product of randomProducts) {
    await page.goto(product.url);
    await humanScroll(page, 500);
    await randomDelay(1000, 3000);
  }

  // Check cart (empty)
  await page.goto(`${retailer.baseUrl}/cart`);
  await randomDelay(1000, 2000);
}
```

## Testing Detection

### Validation Sites

- **bot.sannysoft.com**: Basic fingerprint tests
- **bot.incolumitas.com**: Advanced detection (behavioral score)
- **browserleaks.com**: Comprehensive fingerprint analysis
- **pixelscan.net**: Stealth configuration testing

### Self-Testing

```typescript
async function testStealthConfig(page: Page): Promise<StealthScore> {
  await page.goto('https://bot.incolumitas.com/');
  await page.waitForTimeout(5000);

  const score = await page.evaluate(() => {
    return window.behavioralClassificationScore;
  });

  return {
    score,
    passed: score > 0.6, // 60%+ human-like
  };
}
```

## Best Practices Summary

1. **Never run headless** - Use `headless: false` or headed mode
2. **Rotate fingerprints** - Different fingerprint per account, consistent per session
3. **Use residential proxies** - Match proxy location to account shipping address
4. **Warm up sessions** - Browse normally before attempting purchase
5. **Human-like timing** - Random delays, natural mouse movements
6. **Save cookies** - Reuse sessions to build trust
7. **Test regularly** - Detection methods evolve constantly

## Sources

- [ScrapeOps - Making Playwright Undetectable](https://scrapeops.io/playwright-web-scraping-playbook/nodejs-playwright-make-playwright-undetectable/)
- [Bright Data - Playwright Stealth](https://brightdata.com/blog/how-tos/avoid-bot-detection-with-playwright-stealth)
- [ZenRows - Playwright Fingerprinting](https://www.zenrows.com/blog/playwright-fingerprint)
- [Castle.io - Anti-Detect Frameworks Evolution](https://blog.castle.io/from-puppeteer-stealth-to-nodriver-how-anti-detect-frameworks-evolved-to-evade-bot-detection/)
- [Kameleo - Bypass Cloudflare with Playwright 2025](https://kameleo.io/blog/how-to-bypass-cloudflare-with-playwright)
