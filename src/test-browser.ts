/**
 * Test script to verify browser stealth setup
 * Run with: npm run test:browser
 */

import { launchBrowser, closeBrowser, getPage } from './browser/launcher.js';
import { humanScroll, humanPause, randomDelay } from './browser/human.js';
import 'dotenv/config';

async function testBrowser() {
  console.log('🧪 Testing browser stealth configuration...\n');

  // Get proxy config from env
  const proxy = process.env.PROXY_HOST ? {
    host: process.env.PROXY_HOST,
    port: parseInt(process.env.PROXY_PORT || '7000'),
    username: process.env.PROXY_USER,
    password: process.env.PROXY_PASS,
  } : undefined;

  if (proxy) {
    console.log(`🌐 Using proxy: ${proxy.host}:${proxy.port}`);
  } else {
    console.log('⚠️  No proxy configured. Using direct connection.');
    console.log('   For Costco, you NEED a residential proxy!\n');
  }

  // Launch browser
  const page = await launchBrowser({ headless: false, proxy });

  try {
    // Test 1: Bot detection test
    console.log('\n📋 Test 1: Bot detection check (sannysoft.com)');
    await page.goto('https://bot.sannysoft.com/');
    await humanPause('checking bot detection results');
    await page.screenshot({ path: './screenshots/test-sannysoft.png', fullPage: true });
    console.log('   Screenshot saved to ./screenshots/test-sannysoft.png');

    // Test 2: IP check
    console.log('\n📋 Test 2: IP address check');
    await page.goto('https://httpbin.org/ip');
    const ipText = await page.textContent('body');
    console.log(`   Your IP: ${ipText}`);

    // Test 3: Fingerprint check
    console.log('\n📋 Test 3: Browser fingerprint check (pixelscan.net)');
    await page.goto('https://pixelscan.net/');
    await humanPause('analyzing fingerprint');
    await humanScroll(page, 300);
    await randomDelay(2000, 3000);
    await page.screenshot({ path: './screenshots/test-pixelscan.png', fullPage: false });
    console.log('   Screenshot saved to ./screenshots/test-pixelscan.png');

    // Test 4: Costco homepage (the real test)
    console.log('\n📋 Test 4: Costco.com homepage');
    await page.goto('https://www.costco.com/');
    await randomDelay(2000, 4000);

    // Check if we got blocked
    const pageContent = await page.textContent('body');
    if (pageContent?.includes('Access Denied') || pageContent?.includes('blocked')) {
      console.log('   ❌ BLOCKED by Akamai!');
      console.log('   You need a residential proxy to access Costco.');
    } else {
      console.log('   ✅ Costco homepage loaded successfully!');
      await page.screenshot({ path: './screenshots/test-costco.png' });
      console.log('   Screenshot saved to ./screenshots/test-costco.png');
    }

    console.log('\n✅ Browser test complete!');
    console.log('   Check the screenshots folder to see results.');
    console.log('\n   Press Ctrl+C to close the browser...');

    // Keep browser open for manual inspection
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await closeBrowser();
  }
}

testBrowser().catch(console.error);
