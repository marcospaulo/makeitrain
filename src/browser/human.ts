import { Page, ElementHandle } from 'playwright';

/**
 * Human-like behavior simulation
 * These functions add randomness and natural patterns to browser interactions
 */

// Random delay between min and max milliseconds
export async function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise(resolve => setTimeout(resolve, delay));
}

// Human-like mouse movement using bezier curves
export async function humanMouseMove(page: Page, x: number, y: number): Promise<void> {
  const steps = Math.floor(Math.random() * 15) + 10;

  // Get current mouse position (approximate)
  const currentPos = { x: 0, y: 0 };

  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    // Ease in-out curve
    const easeProgress = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    const newX = currentPos.x + (x - currentPos.x) * easeProgress;
    const newY = currentPos.y + (y - currentPos.y) * easeProgress;

    // Add slight jitter
    const jitterX = (Math.random() - 0.5) * 3;
    const jitterY = (Math.random() - 0.5) * 3;

    await page.mouse.move(newX + jitterX, newY + jitterY);
    await randomDelay(5, 15);
  }
}

// Human-like typing with variable speed
export async function humanType(page: Page, selector: string, text: string): Promise<void> {
  await page.click(selector);
  await randomDelay(100, 300);

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    await page.keyboard.type(char);

    // Variable typing speed
    let delay = Math.floor(Math.random() * 80) + 30;

    // Occasional longer pause (like thinking)
    if (Math.random() < 0.05) {
      delay += Math.floor(Math.random() * 300) + 100;
    }

    // Slightly longer pause after spaces or punctuation
    if ([' ', '.', ',', '!', '?'].includes(char)) {
      delay += Math.floor(Math.random() * 50) + 20;
    }

    await randomDelay(delay, delay + 20);
  }
}

// Human-like click with mouse movement
export async function humanClick(page: Page, selector: string): Promise<void> {
  const element = await page.$(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  const box = await element.boundingBox();
  if (!box) {
    throw new Error(`Could not get bounding box for: ${selector}`);
  }

  // Click at a random position within the element
  const x = box.x + box.width * (0.3 + Math.random() * 0.4);
  const y = box.y + box.height * (0.3 + Math.random() * 0.4);

  // Move to element
  await humanMouseMove(page, x, y);
  await randomDelay(50, 150);

  // Click
  await page.mouse.click(x, y);
  await randomDelay(100, 300);
}

// Human-like scrolling
export async function humanScroll(page: Page, targetY: number): Promise<void> {
  const currentY = await page.evaluate(() => window.scrollY);
  const distance = targetY - currentY;
  const steps = Math.abs(Math.floor(distance / 100)) + 1;

  for (let i = 0; i < steps; i++) {
    const scrollAmount = (distance / steps) + (Math.random() - 0.5) * 30;
    await page.evaluate((amount) => {
      window.scrollBy({ top: amount, behavior: 'smooth' });
    }, scrollAmount);
    await randomDelay(50, 150);
  }
}

// Wait for element with human-like patience
export async function humanWaitFor(
  page: Page,
  selector: string,
  timeout: number = 10000
): Promise<ElementHandle | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const element = await page.$(selector);
    if (element) {
      // Small delay before returning (human wouldn't react instantly)
      await randomDelay(100, 300);
      return element;
    }
    await randomDelay(200, 500);
  }

  return null;
}

// Simulate reading/looking at page
export async function humanPause(description: string = 'looking at page'): Promise<void> {
  console.log(`👀 ${description}...`);
  await randomDelay(1000, 3000);
}
