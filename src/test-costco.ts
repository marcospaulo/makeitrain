/**
 * Costco Stock Monitor & Quick Checkout
 *
 * This script monitors a Costco product page and attempts checkout when in stock.
 * Run with: npm run test:costco
 *
 * Required env vars:
 * - PROXY_HOST, PROXY_PORT, PROXY_USER, PROXY_PASS (residential proxy)
 * - TARGET_URL (Costco product page URL)
 * - COSTCO_EMAIL, COSTCO_PASSWORD (your Costco login)
 */

import { launchBrowser, closeBrowser, getPage, saveCookies, loadCookies } from './browser/launcher.js';
import { humanClick, humanType, humanScroll, humanPause, randomDelay, humanWaitFor } from './browser/human.js';
import 'dotenv/config';
import { Page } from 'playwright';

// Configuration
const CONFIG = {
  targetUrl: process.env.TARGET_URL || '',
  targetKeywords: (process.env.TARGET_KEYWORDS || '').split(',').filter(k => k.trim()),
  costcoEmail: process.env.COSTCO_EMAIL || '',
  costcoPassword: process.env.COSTCO_PASSWORD || '',
  checkIntervalMs: 30000, // Check every 30 seconds
  discordWebhook: process.env.DISCORD_WEBHOOK || '',
};

// Send Discord notification
async function notify(message: string, urgent: boolean = false) {
  console.log(`📢 ${message}`);

  if (CONFIG.discordWebhook) {
    try {
      await fetch(CONFIG.discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: urgent ? `@everyone 🚨 ${message}` : message,
        }),
      });
    } catch (e) {
      console.error('Failed to send Discord notification');
    }
  }
}

// Check if logged in to Costco
async function isLoggedIn(page: Page): Promise<boolean> {
  const accountLink = await page.$('a[href*="/account"]');
  const signInLink = await page.$('a[href*="/LogonForm"]');
  return !!accountLink && !signInLink;
}

// Login to Costco
async function login(page: Page): Promise<boolean> {
  console.log('🔐 Logging in to Costco...');

  await page.goto('https://www.costco.com/LogonForm');
  await randomDelay(2000, 4000);

  // Check for Akamai block
  const blocked = await page.$('text="Access Denied"');
  if (blocked) {
    console.log('❌ Blocked by Akamai! Need better proxy.');
    return false;
  }

  // Enter credentials
  await humanType(page, '#logonId', CONFIG.costcoEmail);
  await randomDelay(500, 1000);

  await humanType(page, '#logonPassword', CONFIG.costcoPassword);
  await randomDelay(500, 1000);

  // Click sign in
  await humanClick(page, 'input[value="Sign In"], button[type="submit"]');
  await randomDelay(3000, 5000);

  // Check if login succeeded
  const success = await isLoggedIn(page);
  if (success) {
    console.log('✅ Logged in successfully!');
    await saveCookies('./data/cookies/costco.json');
  } else {
    console.log('❌ Login failed. Check credentials or CAPTCHA.');
  }

  return success;
}

// Check stock status
async function checkStock(page: Page, url: string): Promise<{ inStock: boolean; buttonText?: string }> {
  await page.goto(url);
  await randomDelay(2000, 4000);

  // Check for Akamai block
  const blocked = await page.$('text="Access Denied"');
  if (blocked) {
    console.log('❌ Blocked by Akamai!');
    return { inStock: false };
  }

  // Check for add to cart button
  const addToCartBtn = await page.$('#add-to-cart-btn:not([disabled]), button[data-testid="add-to-cart"]:not([disabled])');

  if (addToCartBtn) {
    const buttonText = await addToCartBtn.textContent();
    return { inStock: true, buttonText: buttonText?.trim() };
  }

  // Check for out of stock indicators
  const outOfStock = await page.$('.out-of-stock-message, .oos-overlay, text="Out of Stock"');
  if (outOfStock) {
    return { inStock: false };
  }

  return { inStock: false };
}

// Add to cart
async function addToCart(page: Page): Promise<boolean> {
  console.log('🛒 Adding to cart...');

  const addBtn = await page.$('#add-to-cart-btn:not([disabled]), button[data-testid="add-to-cart"]:not([disabled])');
  if (!addBtn) {
    console.log('❌ Add to cart button not found!');
    return false;
  }

  await humanClick(page, '#add-to-cart-btn, button[data-testid="add-to-cart"]');
  await randomDelay(2000, 4000);

  // Check for CAPTCHA
  const captcha = await page.$('.g-recaptcha, #px-captcha, iframe[src*="captcha"]');
  if (captcha) {
    console.log('⚠️ CAPTCHA detected! Waiting for manual solve...');
    await notify('🔴 CAPTCHA DETECTED - MANUAL INTERVENTION NEEDED!', true);
    // Wait up to 2 minutes for manual solve
    await page.waitForSelector('#add-to-cart-btn[disabled], .cart-added', { timeout: 120000 }).catch(() => null);
  }

  // Wait for cart confirmation
  await randomDelay(2000, 3000);

  // Navigate to cart to verify
  await page.goto('https://www.costco.com/CheckoutCartDisplayView');
  await randomDelay(2000, 3000);

  const cartItems = await page.$$('.product-cell, .cart-item');
  const success = cartItems.length > 0;

  if (success) {
    console.log('✅ Item added to cart!');
  } else {
    console.log('❌ Failed to add to cart');
  }

  return success;
}

// Checkout
async function checkout(page: Page): Promise<boolean> {
  console.log('💳 Starting checkout...');

  // Should already be on cart page
  const checkoutBtn = await page.$('button[data-testid="checkout"], #checkoutBtn, a[href*="checkout"]');
  if (!checkoutBtn) {
    console.log('❌ Checkout button not found!');
    await page.screenshot({ path: './screenshots/checkout-error.png' });
    return false;
  }

  await humanClick(page, 'button[data-testid="checkout"], #checkoutBtn, a[href*="checkout"]');
  await randomDelay(3000, 5000);

  // At this point, if payment/shipping is saved, we should see order review
  // Take screenshot for manual verification
  await page.screenshot({ path: './screenshots/checkout-review.png' });
  console.log('📸 Screenshot saved: checkout-review.png');

  // Look for place order button
  const placeOrderBtn = await humanWaitFor(page, 'button[data-testid="place-order"], #placeOrderBtn', 30000);

  if (!placeOrderBtn) {
    console.log('⚠️ Place order button not found. May need manual intervention.');
    await notify('🔴 CHECKOUT READY - MANUAL PLACE ORDER NEEDED!', true);
    return false;
  }

  // WARNING: Uncomment the next line to auto-place order
  // await humanClick(page, 'button[data-testid="place-order"], #placeOrderBtn');

  console.log('🎯 READY TO PLACE ORDER - Manual confirmation needed');
  await notify('🎉 READY TO PLACE ORDER! Check the browser!', true);

  return true;
}

// Main monitoring loop
async function monitor() {
  if (!CONFIG.targetUrl) {
    console.log('❌ No TARGET_URL set. Set it in .env file.');
    console.log('   Example: TARGET_URL=https://www.costco.com/some-product.html');
    process.exit(1);
  }

  console.log('🚀 Starting Costco Stock Monitor');
  console.log(`   Target: ${CONFIG.targetUrl}`);
  console.log(`   Check interval: ${CONFIG.checkIntervalMs / 1000}s`);

  // Get proxy config
  const proxy = process.env.PROXY_HOST ? {
    host: process.env.PROXY_HOST,
    port: parseInt(process.env.PROXY_PORT || '7000'),
    username: process.env.PROXY_USER,
    password: process.env.PROXY_PASS,
  } : undefined;

  if (!proxy) {
    console.log('\n⚠️  WARNING: No proxy configured!');
    console.log('   Costco will likely block you without a residential proxy.');
    console.log('   Set PROXY_HOST, PROXY_PORT, PROXY_USER, PROXY_PASS in .env\n');
  }

  // Launch browser
  const page = await launchBrowser({ headless: false, proxy });

  try {
    // Try to load saved session
    const hasSession = await loadCookies('./data/cookies/costco.json');

    // Navigate to Costco first
    await page.goto('https://www.costco.com/');
    await randomDelay(2000, 4000);

    // Check if blocked
    const blocked = await page.$('text="Access Denied"');
    if (blocked) {
      console.log('❌ Blocked by Akamai immediately!');
      console.log('   Your proxy is not working or is flagged.');
      await page.screenshot({ path: './screenshots/blocked.png' });
      return;
    }

    // Login if needed
    if (!await isLoggedIn(page)) {
      if (CONFIG.costcoEmail && CONFIG.costcoPassword) {
        const loggedIn = await login(page);
        if (!loggedIn) {
          console.log('❌ Could not login. Exiting.');
          return;
        }
      } else {
        console.log('⚠️ Not logged in and no credentials provided.');
        console.log('   Set COSTCO_EMAIL and COSTCO_PASSWORD in .env');
        console.log('   Or login manually in the browser window...');
        await notify('Please login to Costco in the browser window');
        await page.waitForTimeout(60000); // Wait for manual login
      }
    }

    console.log('\n🔍 Starting stock monitoring loop...\n');

    // Monitoring loop
    let checkCount = 0;
    while (true) {
      checkCount++;
      const timestamp = new Date().toLocaleTimeString();

      console.log(`[${timestamp}] Check #${checkCount}...`);

      const { inStock, buttonText } = await checkStock(page, CONFIG.targetUrl);

      if (inStock) {
        console.log(`\n🎉 IN STOCK! Button text: "${buttonText}"`);
        await notify(`🎉 ITEM IN STOCK! ${CONFIG.targetUrl}`, true);

        // Take screenshot
        await page.screenshot({ path: `./screenshots/in-stock-${Date.now()}.png` });

        // Attempt to add to cart
        const addedToCart = await addToCart(page);

        if (addedToCart) {
          // Attempt checkout
          const checkoutReady = await checkout(page);

          if (checkoutReady) {
            console.log('\n✅ Checkout ready! Keeping browser open...');
            // Keep browser open for manual order placement
            await page.waitForTimeout(300000); // 5 minutes
          }
        }
      } else {
        process.stdout.write(`   Out of stock. Next check in ${CONFIG.checkIntervalMs / 1000}s\r`);
      }

      // Wait before next check
      await page.waitForTimeout(CONFIG.checkIntervalMs);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ path: './screenshots/error.png' });
  } finally {
    await closeBrowser();
  }
}

// Run
monitor().catch(console.error);
