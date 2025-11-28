# Retailer-Specific Implementation Guide

## Target

### Overview

Target is one of the more challenging retailers due to their sophisticated bot protection. They use "Shape" protection for high-demand items and have strict account/IP correlation requirements.

### Anti-Bot Measures

| Protection | Description |
|------------|-------------|
| **Shape Security** | Enterprise bot protection for hype products |
| **Account Locking** | Locks accounts accessed from multiple IPs |
| **Cookie Validation** | Requires valid cookies for hype item carting |
| **No CAPTCHA** | Relies on behavioral/IP analysis instead |
| **Item Demand Cancellations** | Orders flagged by fraud system get cancelled |

### Account Requirements

```typescript
interface TargetAccount {
  email: string;           // Must be @gmail.com (no catch-all)
  password: string;
  paymentMethod: {
    type: 'credit' | 'debit' | 'target_redcard';
    cardNumber: string;
    expiry: string;
    cvv: string;
    billingAddress: Address;
  };
  shippingAddress: Address;
}
```

**Important Notes:**
- Use real @gmail.com addresses only
- Catch-all domains are blocked
- One account per IP/proxy recommended
- Consistent IP region with shipping address

### Drop Patterns

- **Typical drop window:** 6am - 9am EST on weekdays
- **Console restocks:** Often require in-store pickup only
- **Trading cards:** High cancel rate, limit quantities
- **Electronics:** May be Shape-protected during high demand

### Implementation Flow

```typescript
class TargetModule implements RetailerModule {
  name = 'target';
  baseUrl = 'https://www.target.com';

  async login(page: Page, account: AccountConfig): Promise<boolean> {
    // Load existing cookies first
    const hasCookies = await this.loadCookies(page, account.id);

    if (hasCookies) {
      // Verify session is still valid
      await page.goto('https://www.target.com/account');
      if (await this.isLoggedIn(page)) {
        return true;
      }
    }

    // Fresh login required
    await page.goto('https://www.target.com/account');
    await randomDelay(1000, 2000);

    // Click sign in
    await page.click('[data-test="accountNav-signIn"]');
    await randomDelay(500, 1000);

    // Enter email
    await humanType(page, '#username', account.email);
    await randomDelay(200, 500);

    // Enter password
    await humanType(page, '#password', account.password);
    await randomDelay(300, 700);

    // Submit
    await page.click('#login');
    await page.waitForNavigation({ waitUntil: 'networkidle' });

    // Save cookies for future use
    await this.saveCookies(page, account.id);

    return await this.isLoggedIn(page);
  }

  async checkStock(page: Page, productUrl: string): Promise<StockStatus> {
    await page.goto(productUrl);
    await randomDelay(500, 1500);

    // Check for "Out of stock" indicators
    const outOfStock = await page.$('[data-test="outOfStockButton"]');
    if (outOfStock) {
      return { inStock: false };
    }

    // Check for "Add to cart" button
    const addToCart = await page.$('[data-test="shipItButton"], [data-test="pickupButton"]');
    if (addToCart) {
      const shippingAvailable = await page.$('[data-test="shipItButton"]');
      const pickupAvailable = await page.$('[data-test="pickupButton"]');

      return {
        inStock: true,
        shipping: !!shippingAvailable,
        pickup: !!pickupAvailable,
      };
    }

    return { inStock: false };
  }

  async addToCart(page: Page, productUrl: string, options: CartOptions): Promise<boolean> {
    await page.goto(productUrl);
    await randomDelay(500, 1000);

    const buttonSelector = options.fulfillment === 'pickup'
      ? '[data-test="pickupButton"]'
      : '[data-test="shipItButton"]';

    const button = await page.$(buttonSelector);
    if (!button) {
      return false;
    }

    await button.click();
    await randomDelay(1000, 2000);

    // Wait for cart confirmation
    const cartConfirm = await page.waitForSelector(
      '[data-test="addToCartModalViewCartCheckout"]',
      { timeout: 10000 }
    ).catch(() => null);

    return !!cartConfirm;
  }

  async checkout(page: Page, account: AccountConfig): Promise<CheckoutResult> {
    // Go to cart
    await page.goto('https://www.target.com/cart');
    await randomDelay(1000, 2000);

    // Click checkout
    await page.click('[data-test="checkout-button"]');
    await page.waitForNavigation();
    await randomDelay(1000, 2000);

    // Should be on checkout page now
    // Payment should be saved on account

    // Place order
    await page.click('[data-test="placeOrderButton"]');

    // Wait for confirmation
    const confirmation = await page.waitForSelector(
      '[data-test="order-confirmation"]',
      { timeout: 30000 }
    ).catch(() => null);

    if (confirmation) {
      const orderNumber = await page.$eval(
        '[data-test="order-number"]',
        el => el.textContent
      );
      return { success: true, orderNumber };
    }

    return { success: false, error: 'Checkout failed' };
  }
}
```

### Shape Protection Handling

```typescript
async function handleShapeProtection(page: Page): Promise<boolean> {
  // Shape protection often shows as invisible challenge
  // Best approach: slow down, act human

  // Random mouse movements
  for (let i = 0; i < 5; i++) {
    await humanMouseMove(
      page,
      Math.random() * 800 + 100,
      Math.random() * 600 + 100
    );
    await randomDelay(200, 500);
  }

  // Scroll naturally
  await humanScroll(page, 300);
  await randomDelay(500, 1000);
  await humanScroll(page, 0);

  // Wait for any background challenges
  await randomDelay(2000, 4000);

  return true;
}
```

---

## Best Buy

### Overview

Best Buy has one of the strongest anti-bot systems in retail. They use a multi-click checkout process with random timers and require human-like behavior throughout.

### Anti-Bot Measures

| Protection | Description |
|------------|-------------|
| **Multi-click checkout** | Multiple button clicks with random delays required |
| **Queue system** | Virtual waiting room for high-demand items |
| **Human verification** | Checks throughout checkout process |
| **Cart reset** | Cart cleared if bot behavior detected |
| **App exclusives** | Some drops only available on mobile app |

### 2025 Updates

- Drops may come early and without warning
- Some products app-exclusive
- Shortened supply on high-demand items
- In-store only releases for certain items

### Account Requirements

```typescript
interface BestBuyAccount {
  email: string;
  password: string;
  paymentMethod: {
    type: 'credit' | 'debit' | 'bestbuy_card';
    cardNumber: string;
    expiry: string;
    cvv: string;
  };
  totalTechMember?: boolean; // Helps with priority access
  shippingAddress: Address;
}
```

### Implementation Flow

```typescript
class BestBuyModule implements RetailerModule {
  name = 'bestbuy';
  baseUrl = 'https://www.bestbuy.com';

  async login(page: Page, account: AccountConfig): Promise<boolean> {
    const hasCookies = await this.loadCookies(page, account.id);

    if (hasCookies) {
      await page.goto('https://www.bestbuy.com/identity/global/signin');
      if (await this.isLoggedIn(page)) {
        return true;
      }
    }

    await page.goto('https://www.bestbuy.com/identity/global/signin');
    await randomDelay(1500, 3000);

    // Enter email
    await humanType(page, '#fld-e', account.email);
    await randomDelay(300, 600);

    // Enter password
    await humanType(page, '#fld-p1', account.password);
    await randomDelay(300, 600);

    // Click sign in
    await page.click('[data-track="Sign In"]');

    try {
      await page.waitForNavigation({ timeout: 15000 });
      await this.saveCookies(page, account.id);
      return true;
    } catch {
      return false;
    }
  }

  async checkStock(page: Page, productUrl: string): Promise<StockStatus> {
    await page.goto(productUrl);
    await randomDelay(1000, 2000);

    // Check button states
    const addToCart = await page.$('.add-to-cart-button:not([disabled])');
    const soldOut = await page.$('.btn-disabled, .sold-out-button');
    const comingSoon = await page.$('.coming-soon-button');

    if (addToCart) {
      return { inStock: true };
    }

    return {
      inStock: false,
      status: soldOut ? 'sold_out' : comingSoon ? 'coming_soon' : 'unavailable',
    };
  }

  async addToCart(page: Page, productUrl: string): Promise<boolean> {
    await page.goto(productUrl);
    await randomDelay(1000, 2000);

    // First click - Add to Cart
    const addButton = await page.$('.add-to-cart-button:not([disabled])');
    if (!addButton) {
      return false;
    }

    await humanMouseMove(page, await this.getElementCenter(addButton));
    await randomDelay(100, 300);
    await addButton.click();

    // Wait for potential second click requirement
    await randomDelay(500, 1500);

    // Check for "Add to Cart" confirmation or additional button
    const continueButton = await page.$('.go-to-cart-button, .continue-button');
    if (continueButton) {
      await randomDelay(300, 700);
      await continueButton.click();
    }

    // Verify item in cart
    await page.goto('https://www.bestbuy.com/cart');
    await randomDelay(1000, 2000);

    const cartItems = await page.$$('.cart-item');
    return cartItems.length > 0;
  }

  async checkout(page: Page, account: AccountConfig): Promise<CheckoutResult> {
    await page.goto('https://www.bestbuy.com/cart');
    await randomDelay(1000, 2000);

    // Click checkout
    const checkoutButton = await page.$('.checkout-buttons__checkout');
    if (!checkoutButton) {
      return { success: false, error: 'Checkout button not found' };
    }

    await checkoutButton.click();
    await page.waitForNavigation();
    await randomDelay(2000, 4000);

    // May need to re-enter CVV
    const cvvField = await page.$('#credit-card-cvv');
    if (cvvField) {
      await humanType(page, '#credit-card-cvv', account.paymentMethod.cvv);
      await randomDelay(500, 1000);
    }

    // Place order - may have multiple confirmation clicks
    for (let attempt = 0; attempt < 3; attempt++) {
      const placeOrder = await page.$('.button--place-order, [data-track="Place Order"]');
      if (placeOrder) {
        await randomDelay(500, 1000);
        await placeOrder.click();
        await randomDelay(1000, 2000);
      }
    }

    // Check for confirmation
    const confirmation = await page.waitForSelector(
      '.thank-you-enhancement, .order-confirmation',
      { timeout: 30000 }
    ).catch(() => null);

    if (confirmation) {
      const orderNumber = await this.extractOrderNumber(page);
      return { success: true, orderNumber };
    }

    return { success: false, error: 'Order not confirmed' };
  }
}
```

### Queue Bypass Considerations

```typescript
async function handleBestBuyQueue(page: Page): Promise<boolean> {
  // Check if in queue
  const queuePage = await page.$('.queue-it_html');
  if (!queuePage) {
    return true; // Not in queue
  }

  // Option 1: Wait in queue (most reliable)
  console.log('In queue, waiting...');

  // Monitor queue position
  const checkInterval = setInterval(async () => {
    const position = await page.$eval(
      '.queue-it_position',
      el => el.textContent
    ).catch(() => null);
    console.log(`Queue position: ${position}`);
  }, 30000);

  // Wait for queue exit (up to 30 minutes)
  try {
    await page.waitForSelector('.add-to-cart-button', { timeout: 1800000 });
    clearInterval(checkInterval);
    return true;
  } catch {
    clearInterval(checkInterval);
    return false;
  }
}
```

---

## Costco

### Overview

Costco uses Akamai's enterprise bot protection, making it one of the more challenging retailers for automation. Traditional headless browser approaches often fail with 401 Unauthorized errors even before reaching the product page.

### Anti-Bot Measures

| Protection | Description |
|------------|-------------|
| **Akamai Bot Manager** | Enterprise-grade protection blocking headless browsers |
| **401 Unauthorized** | Backend API protected, blocks even Selenium/Playwright |
| **Membership Required** | Must be logged-in member to purchase |
| **CAPTCHA Checkboxes** | Checkbox CAPTCHAs may appear (image CAPTCHAs require manual solve) |
| **Separate Carts** | Same-day delivery (Instacart) cart separate from costco.com cart |

### Account Requirements

```typescript
interface CostcoAccount {
  email: string;
  password: string;
  membershipNumber: string;
  membershipType: 'gold_star' | 'executive' | 'business';
  paymentMethod: {
    type: 'credit' | 'debit' | 'costco_visa';
    cardNumber: string;
    expiry: string;
    cvv: string;
  };
  shippingAddress: Address;
}
```

### Delivery Options

| Option | Platform | Notes |
|--------|----------|-------|
| **Standard Shipping** | costco.com | 3-7 business days |
| **Same-Day Delivery** | sameday.costco.com (Instacart) | 1 hour - same day, $35 minimum |
| **2-Day Delivery** | costco.com | Select items only |

### Implementation Challenges

```typescript
class CostcoModule implements RetailerModule {
  name = 'costco';
  baseUrl = 'https://www.costco.com';

  // WARNING: Costco's Akamai protection is very aggressive
  // Standard Playwright will likely fail with 401 errors

  async login(page: Page, account: AccountConfig): Promise<boolean> {
    // Akamai checks start immediately
    // Must have valid cookies/session or will be blocked

    await page.goto('https://www.costco.com/LogonForm');
    await randomDelay(2000, 4000);

    // Check if Akamai blocked us
    const blocked = await page.$('text="Access Denied"');
    if (blocked) {
      console.log('Blocked by Akamai - need better stealth or residential proxy');
      return false;
    }

    await humanType(page, '#logonId', account.email);
    await randomDelay(300, 600);

    await humanType(page, '#logonPassword', account.password);
    await randomDelay(300, 600);

    await page.click('input[value="Sign In"]');

    try {
      await page.waitForNavigation({ timeout: 15000 });
      return await this.verifyLogin(page);
    } catch {
      return false;
    }
  }

  async checkStock(page: Page, productUrl: string): Promise<StockStatus> {
    await page.goto(productUrl);
    await randomDelay(1000, 2000);

    // Check for out of stock
    const outOfStock = await page.$('.out-of-stock-message, .oos-overlay');
    if (outOfStock) {
      return { inStock: false };
    }

    // Check for add to cart
    const addToCart = await page.$('#add-to-cart-btn:not([disabled])');
    return { inStock: !!addToCart };
  }

  async addToCart(page: Page, productUrl: string): Promise<boolean> {
    await page.goto(productUrl);
    await randomDelay(1000, 2000);

    const addButton = await page.$('#add-to-cart-btn:not([disabled])');
    if (!addButton) {
      return false;
    }

    await addButton.click();
    await randomDelay(1500, 3000);

    // Check for CAPTCHA
    const captcha = await page.$('.g-recaptcha, #px-captcha');
    if (captcha) {
      console.log('CAPTCHA detected - may need manual intervention');
      // Handle or wait for manual solve
    }

    // Verify cart
    await page.goto('https://www.costco.com/CheckoutCartDisplayView');
    const cartItems = await page.$$('.cart-item, .product-cell');
    return cartItems.length > 0;
  }
}
```

### Bypassing Akamai (Advanced)

Akamai is one of the hardest protections to bypass. Options:

1. **Real Browser Profile**: Use saved browser profile with history/cookies
2. **Residential Proxies**: Datacenter IPs are immediately flagged
3. **Anti-Detect Browsers**: Kameleo, Multilogin with real fingerprints
4. **Request-Based with Sensors**: Replicate Akamai sensor data (very complex)

### Same-Day via Instacart

Costco same-day uses Instacart's infrastructure. Consider automating through Instacart's platform instead:

```typescript
// Same-day delivery goes through Instacart
const sameDayUrl = 'https://sameday.costco.com';

// Instacart has its own bot protection but may be easier than Costco direct
// Minimum order: $35
// Delivery fee avoided at $75+
```

---

## Sam's Club

### Overview

Sam's Club (Walmart-owned) is transitioning to app-first checkout with their "Scan & Go" system. By December 2025, all traditional checkouts will be replaced with AI-powered exit technology. Online ordering still works via website/app.

### Anti-Bot Measures

| Protection | Description |
|------------|-------------|
| **Membership Required** | Must be logged-in Plus or Club member |
| **App-Focused** | Pushing users to mobile app for best experience |
| **AI Exit Verification** | In-store uses computer vision to verify purchases |
| **Transaction Limits** | $1,500 per transaction, $3,000 daily via Scan & Go |

### Account Requirements

```typescript
interface SamsClubAccount {
  email: string;
  password: string;
  membershipType: 'club' | 'plus'; // Plus gets free shipping
  paymentMethod: {
    type: 'credit' | 'debit' | 'sams_mastercard';
    cardNumber: string;
    expiry: string;
    cvv: string;
  };
  shippingAddress: Address;
}
```

### Membership Benefits for Automation

| Feature | Club | Plus |
|---------|------|------|
| **Free Shipping** | No (varies) | Yes (most items) |
| **Early Access** | No | Sometimes |
| **Curbside Pickup** | Yes | Yes |

### Implementation Flow

```typescript
class SamsClubModule implements RetailerModule {
  name = 'samsclub';
  baseUrl = 'https://www.samsclub.com';

  async login(page: Page, account: AccountConfig): Promise<boolean> {
    const hasCookies = await this.loadCookies(page, account.id);

    if (hasCookies) {
      await page.goto('https://www.samsclub.com/account');
      if (await this.isLoggedIn(page)) {
        return true;
      }
    }

    await page.goto('https://www.samsclub.com/sams/account/signin/login.jsp');
    await randomDelay(1500, 3000);

    await humanType(page, '#emailField', account.email);
    await randomDelay(300, 600);

    await humanType(page, '#passwordField', account.password);
    await randomDelay(300, 600);

    await page.click('button[type="submit"]');

    try {
      await page.waitForNavigation({ timeout: 15000 });
      await this.saveCookies(page, account.id);
      return true;
    } catch {
      return false;
    }
  }

  async checkStock(page: Page, productUrl: string): Promise<StockStatus> {
    await page.goto(productUrl);
    await randomDelay(1000, 2000);

    // Check availability
    const outOfStock = await page.$('[data-automation="out-of-stock"]');
    if (outOfStock) {
      return { inStock: false };
    }

    const addToCart = await page.$('button[data-automation="add-to-cart"]:not([disabled])');
    const shipAvailable = await page.$('[data-automation="shipping-available"]');
    const pickupAvailable = await page.$('[data-automation="club-pickup"]');

    return {
      inStock: !!addToCart,
      shipping: !!shipAvailable,
      pickup: !!pickupAvailable,
    };
  }

  async addToCart(page: Page, productUrl: string, options: CartOptions): Promise<boolean> {
    await page.goto(productUrl);
    await randomDelay(1000, 2000);

    // Select fulfillment method if available
    if (options.fulfillment === 'pickup') {
      const pickupOption = await page.$('[data-automation="club-pickup"]');
      if (pickupOption) {
        await pickupOption.click();
        await randomDelay(500, 1000);
      }
    }

    const addButton = await page.$('button[data-automation="add-to-cart"]:not([disabled])');
    if (!addButton) {
      return false;
    }

    await addButton.click();
    await randomDelay(1500, 3000);

    // Verify in cart
    await page.goto('https://www.samsclub.com/cart');
    const cartItems = await page.$$('.cart-item');
    return cartItems.length > 0;
  }

  async checkout(page: Page, account: AccountConfig): Promise<CheckoutResult> {
    await page.goto('https://www.samsclub.com/cart');
    await randomDelay(1000, 2000);

    // Click checkout
    await page.click('button[data-automation="checkout-btn"]');
    await page.waitForNavigation();
    await randomDelay(2000, 4000);

    // Enter CVV if required (usually saved cards need this)
    const cvvField = await page.$('input[data-automation="cvv-input"]');
    if (cvvField) {
      await humanType(page, 'input[data-automation="cvv-input"]', account.paymentMethod.cvv);
      await randomDelay(500, 1000);
    }

    // Place order
    await page.click('button[data-automation="place-order-btn"]');

    const confirmation = await page.waitForSelector(
      '[data-automation="order-confirmation"]',
      { timeout: 30000 }
    ).catch(() => null);

    if (confirmation) {
      const orderNumber = await page.$eval(
        '[data-automation="order-number"]',
        el => el.textContent
      );
      return { success: true, orderNumber };
    }

    return { success: false, error: 'Checkout failed' };
  }
}
```

### Direct Cart URLs (Not Available)

Unlike some retailers, Sam's Club doesn't expose public add-to-cart URL parameters. Must use browser automation to add items.

### Mobile App Consideration

Sam's Club heavily favors the mobile app experience. For in-store purchases, the Scan & Go feature is the primary method. Online automation should focus on the website rather than trying to automate the mobile app.

---

## Adding New Retailers

### Module Template

```typescript
import { RetailerModule, Page, AccountConfig, StockStatus, CheckoutResult } from '../types';

export class NewRetailerModule implements RetailerModule {
  name = 'newretailer';
  baseUrl = 'https://www.newretailer.com';

  // Required selectors - map during development
  private selectors = {
    login: {
      emailField: '#email',
      passwordField: '#password',
      submitButton: '#submit',
    },
    product: {
      addToCartButton: '.add-to-cart',
      outOfStockIndicator: '.out-of-stock',
      priceElement: '.price',
    },
    cart: {
      checkoutButton: '.checkout',
      cartItems: '.cart-item',
    },
    checkout: {
      placeOrderButton: '.place-order',
      confirmationElement: '.confirmation',
      orderNumberElement: '.order-number',
    },
  };

  async login(page: Page, account: AccountConfig): Promise<boolean> {
    // Implementation
  }

  async checkStock(page: Page, productUrl: string): Promise<StockStatus> {
    // Implementation
  }

  async addToCart(page: Page, productUrl: string, quantity: number): Promise<boolean> {
    // Implementation
  }

  async checkout(page: Page, account: AccountConfig): Promise<CheckoutResult> {
    // Implementation
  }

  // Helper methods specific to this retailer
  private async handleSpecificProtection(page: Page): Promise<void> {
    // Retailer-specific logic
  }
}
```

### Discovery Process for New Retailers

1. **Manual reconnaissance**
   - Create account manually
   - Complete purchase flow
   - Note all steps and delays

2. **Network analysis**
   - Monitor API calls during checkout
   - Identify required headers/tokens
   - Find stock check endpoints

3. **Protection identification**
   - Test with vanilla Playwright
   - Note where blocks occur
   - Identify CAPTCHA types

4. **Selector mapping**
   - Document all required selectors
   - Note dynamic/changing elements
   - Identify wait conditions

---

## Common Patterns Across Retailers

### Stock Monitoring

```typescript
async function monitorStock(
  module: RetailerModule,
  page: Page,
  productUrl: string,
  checkInterval: number = 5000
): Promise<StockStatus> {
  while (true) {
    const status = await module.checkStock(page, productUrl);

    if (status.inStock) {
      return status;
    }

    // Add jitter to interval
    const jitter = Math.random() * 2000 - 1000;
    await new Promise(r => setTimeout(r, checkInterval + jitter));
  }
}
```

### Error Recovery

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.log(`Attempt ${attempt} failed: ${error.message}`);

      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, delayMs * attempt));
      }
    }
  }

  throw lastError;
}
```

## Sources

- [Tidal Market - Retail Botting Guide](https://www.tidalmarket.com/blog/retail-botting-guide)
- [Refract Bot - Target Module](https://help.refractbot.com/modules/target)
- [NikeShoeBot - Best Buy Bot](https://www.nikeshoebot.com/best-buy-bot/)
- [AIO Bot - Target Bots](https://www.aiobot.com/target-bots/)
- [Unwrangle - How to Scrape Costco 2025](https://www.unwrangle.com/blog/how-to-scrape-costco/)
- [Stellar AIO - Costco Module](https://guides.stellaraio.com/stellar/retailers/costco)
- [DataDome - Bot Security 2025](https://datadome.co/bot-management-protection/bigger-businesses-still-fail-bot-protection/)
- [Walmart Tech - Sam's Club AI Exit Technology](https://tech.walmart.com/content/walmart-global-tech/en_us/blog/post/sams-club-ai-exit-technology.html)
- [CNBC - Sam's Club Checkout-Free Future](https://www.cnbc.com/2024/10/07/sams-club-scan-and-go-technology.html)
- [Best Buy Developer API](https://bestbuyapis.github.io/api-documentation/)
