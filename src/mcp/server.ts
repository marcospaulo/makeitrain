#!/usr/bin/env node

/**
 * MCP Server for Browser Automation
 *
 * This server exposes browser control tools that can be used by an AI agent
 * to perform human-like web automation tasks.
 *
 * Tools:
 * - screenshot: Take a screenshot (returns base64 image for AI to "see")
 * - navigate: Go to a URL
 * - click: Click an element
 * - type: Type text into an input
 * - scroll: Scroll the page
 * - get_page_info: Get current URL, title, and visible text
 * - check_element: Check if an element exists and its state
 * - costco_add_to_cart: Costco-specific add to cart
 * - costco_checkout: Costco-specific checkout flow
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { launchBrowser, getPage, closeBrowser, saveCookies, loadCookies } from '../browser/launcher.js';
import { humanClick, humanType, humanScroll, humanPause, randomDelay } from '../browser/human.js';
import { Page } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';

// Screenshot directory
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || './screenshots';

// Tool definitions
const tools: Tool[] = [
  {
    name: 'launch_browser',
    description: 'Launch the browser with stealth mode. Call this first before any other browser operations.',
    inputSchema: {
      type: 'object',
      properties: {
        proxy_host: { type: 'string', description: 'Proxy host (e.g., gate.smartproxy.com)' },
        proxy_port: { type: 'number', description: 'Proxy port (e.g., 7000)' },
        proxy_user: { type: 'string', description: 'Proxy username' },
        proxy_pass: { type: 'string', description: 'Proxy password' },
        headless: { type: 'boolean', description: 'Run in headless mode (default: false)' },
      },
    },
  },
  {
    name: 'screenshot',
    description: 'Take a screenshot of the current page. Returns the image so you can see what is on the screen.',
    inputSchema: {
      type: 'object',
      properties: {
        full_page: { type: 'boolean', description: 'Capture full page (default: false)' },
        name: { type: 'string', description: 'Optional name for the screenshot file' },
      },
    },
  },
  {
    name: 'navigate',
    description: 'Navigate to a URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to' },
        wait_for: { type: 'string', description: 'CSS selector to wait for after navigation' },
      },
      required: ['url'],
    },
  },
  {
    name: 'click',
    description: 'Click an element on the page using human-like mouse movement',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of element to click' },
        description: { type: 'string', description: 'What you are clicking (for logging)' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'type_text',
    description: 'Type text into an input field with human-like typing speed',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of input field' },
        text: { type: 'string', description: 'Text to type' },
        clear_first: { type: 'boolean', description: 'Clear the field before typing (default: true)' },
      },
      required: ['selector', 'text'],
    },
  },
  {
    name: 'scroll',
    description: 'Scroll the page up or down',
    inputSchema: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['up', 'down'], description: 'Direction to scroll' },
        amount: { type: 'number', description: 'Pixels to scroll (default: 500)' },
      },
      required: ['direction'],
    },
  },
  {
    name: 'get_page_info',
    description: 'Get information about the current page including URL, title, and main content',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'check_element',
    description: 'Check if an element exists on the page and get its state',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector to check' },
        description: { type: 'string', description: 'What this element represents' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'wait',
    description: 'Wait for a specified amount of time (simulates human pausing to look at the page)',
    inputSchema: {
      type: 'object',
      properties: {
        seconds: { type: 'number', description: 'Seconds to wait (1-30)' },
        reason: { type: 'string', description: 'Why you are waiting' },
      },
      required: ['seconds'],
    },
  },
  {
    name: 'save_session',
    description: 'Save browser cookies/session for later use',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name for the session (e.g., "costco")' },
      },
      required: ['name'],
    },
  },
  {
    name: 'load_session',
    description: 'Load previously saved browser cookies/session',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the session to load' },
      },
      required: ['name'],
    },
  },
  {
    name: 'close_browser',
    description: 'Close the browser when done',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Tool implementations
async function handleToolCall(name: string, args: Record<string, any>): Promise<any> {
  let page: Page;

  switch (name) {
    case 'launch_browser': {
      const proxy = args.proxy_host ? {
        host: args.proxy_host,
        port: args.proxy_port || 7000,
        username: args.proxy_user,
        password: args.proxy_pass,
      } : undefined;

      await launchBrowser({
        headless: args.headless ?? false,
        proxy,
      });

      return { success: true, message: 'Browser launched with stealth mode' };
    }

    case 'screenshot': {
      page = await getPage();
      await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

      const filename = args.name || `screenshot-${Date.now()}`;
      const filepath = path.join(SCREENSHOT_DIR, `${filename}.png`);

      const buffer = await page.screenshot({
        fullPage: args.full_page ?? false,
        path: filepath,
      });

      // Return base64 for AI to see
      const base64 = buffer.toString('base64');

      return {
        success: true,
        message: `Screenshot saved to ${filepath}`,
        image: {
          type: 'image',
          data: base64,
          mimeType: 'image/png',
        },
      };
    }

    case 'navigate': {
      page = await getPage();
      console.log(`🌐 Navigating to: ${args.url}`);

      await page.goto(args.url, { waitUntil: 'domcontentloaded' });

      if (args.wait_for) {
        await page.waitForSelector(args.wait_for, { timeout: 10000 }).catch(() => null);
      }

      await randomDelay(1000, 2000); // Human-like pause after navigation

      const title = await page.title();
      const url = page.url();

      return {
        success: true,
        message: `Navigated to ${url}`,
        title,
        url,
      };
    }

    case 'click': {
      page = await getPage();
      console.log(`🖱️ Clicking: ${args.description || args.selector}`);

      try {
        await humanClick(page, args.selector);
        await randomDelay(500, 1000);
        return { success: true, message: `Clicked ${args.description || args.selector}` };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }

    case 'type_text': {
      page = await getPage();
      console.log(`⌨️ Typing into: ${args.selector}`);

      try {
        if (args.clear_first !== false) {
          await page.click(args.selector, { clickCount: 3 }); // Select all
          await page.keyboard.press('Backspace');
          await randomDelay(100, 200);
        }

        await humanType(page, args.selector, args.text);
        return { success: true, message: `Typed text into ${args.selector}` };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }

    case 'scroll': {
      page = await getPage();
      const amount = args.amount || 500;
      const direction = args.direction === 'up' ? -amount : amount;

      console.log(`📜 Scrolling ${args.direction} by ${amount}px`);

      const currentY = await page.evaluate(() => window.scrollY);
      await humanScroll(page, currentY + direction);

      return { success: true, message: `Scrolled ${args.direction}` };
    }

    case 'get_page_info': {
      page = await getPage();

      const info = await page.evaluate(() => {
        const getText = (selector: string) => {
          const el = document.querySelector(selector);
          return el ? el.textContent?.trim().slice(0, 500) : null;
        };

        return {
          url: window.location.href,
          title: document.title,
          h1: getText('h1'),
          mainContent: getText('main') || getText('article') || getText('body'),
          buttons: Array.from(document.querySelectorAll('button')).map(b => ({
            text: b.textContent?.trim().slice(0, 50),
            disabled: b.disabled,
            class: b.className,
          })).slice(0, 10),
        };
      });

      return { success: true, ...info };
    }

    case 'check_element': {
      page = await getPage();

      const result = await page.evaluate((selector) => {
        const el = document.querySelector(selector);
        if (!el) return { exists: false };

        const rect = el.getBoundingClientRect();
        return {
          exists: true,
          visible: rect.width > 0 && rect.height > 0,
          text: el.textContent?.trim().slice(0, 200),
          tagName: el.tagName.toLowerCase(),
          disabled: (el as HTMLButtonElement).disabled ?? false,
          className: el.className,
        };
      }, args.selector);

      return {
        success: true,
        selector: args.selector,
        description: args.description,
        ...result,
      };
    }

    case 'wait': {
      const seconds = Math.min(Math.max(args.seconds, 1), 30);
      console.log(`⏳ Waiting ${seconds}s: ${args.reason || 'pausing'}`);
      await new Promise(resolve => setTimeout(resolve, seconds * 1000));
      return { success: true, message: `Waited ${seconds} seconds` };
    }

    case 'save_session': {
      const filepath = `./data/cookies/${args.name}.json`;
      await fs.mkdir('./data/cookies', { recursive: true });
      await saveCookies(filepath);
      return { success: true, message: `Session saved as ${args.name}` };
    }

    case 'load_session': {
      const filepath = `./data/cookies/${args.name}.json`;
      const loaded = await loadCookies(filepath);
      return {
        success: loaded,
        message: loaded ? `Session ${args.name} loaded` : `No session found for ${args.name}`,
      };
    }

    case 'close_browser': {
      await closeBrowser();
      return { success: true, message: 'Browser closed' };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Create MCP server
const server = new Server(
  {
    name: 'browser-automation',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await handleToolCall(name, args || {});
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: error.message }),
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🤖 Browser Automation MCP Server running');
}

main().catch(console.error);
