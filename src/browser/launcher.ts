import { chromium, Browser, BrowserContext, Page } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { resolve } from 'path';

// Apply stealth plugin
chromium.use(StealthPlugin());

export interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface BrowserOptions {
  headless?: boolean;
  proxy?: ProxyConfig;
  userDataDir?: string;
  slowMo?: number;
}

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

export async function launchBrowser(options: BrowserOptions = {}): Promise<Page> {
  const {
    headless = false,
    proxy,
    userDataDir,
    slowMo = 50, // Slight slowdown for human-like behavior
  } = options;

  // Build launch arguments
  const args = [
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-infobars',
    '--window-size=1920,1080',
    '--disable-extensions',
    '--disable-gpu',
    '--disable-software-rasterizer',
  ];

  // Launch browser
  browser = await chromium.launch({
    headless,
    slowMo,
    args,
  });

  // Create context with optional proxy
  const contextOptions: any = {
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
    geolocation: { latitude: 37.7749, longitude: -122.4194 }, // San Francisco
    permissions: ['geolocation'],
  };

  if (proxy) {
    contextOptions.proxy = {
      server: `http://${proxy.host}:${proxy.port}`,
      username: proxy.username,
      password: proxy.password,
    };
  }

  context = await browser.newContext(contextOptions);

  // Apply additional stealth measures
  await context.addInitScript(() => {
    // Remove webdriver flag
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // Mock plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    // Mock languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });

    // Add chrome object
    (window as any).chrome = {
      runtime: {},
    };
  });

  page = await context.newPage();

  console.log('🚀 Browser launched with stealth mode');
  return page;
}

export async function getPage(): Promise<Page> {
  if (!page) {
    throw new Error('Browser not launched. Call launchBrowser() first.');
  }
  return page;
}

export async function closeBrowser(): Promise<void> {
  if (page) await page.close();
  if (context) await context.close();
  if (browser) await browser.close();

  page = null;
  context = null;
  browser = null;

  console.log('🛑 Browser closed');
}

export async function saveCookies(filepath: string): Promise<void> {
  if (!context) throw new Error('No browser context');
  const cookies = await context.cookies();
  const fs = await import('fs/promises');
  await fs.writeFile(filepath, JSON.stringify(cookies, null, 2));
  console.log(`🍪 Cookies saved to ${filepath}`);
}

export async function loadCookies(filepath: string): Promise<boolean> {
  if (!context) throw new Error('No browser context');
  try {
    const fs = await import('fs/promises');
    const data = await fs.readFile(filepath, 'utf-8');
    const cookies = JSON.parse(data);
    await context.addCookies(cookies);
    console.log(`🍪 Cookies loaded from ${filepath}`);
    return true;
  } catch {
    console.log(`⚠️ No cookies found at ${filepath}`);
    return false;
  }
}
