// Captures a sharp close-up of the translation's sentiment map into demo/sentiment-map.png.
// Needs the app running (npm run dev on :3000). Usage: node demo/map-shot.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 3 });
await page.goto('http://127.0.0.1:3000/');
await page.selectOption('#source-language', 'de');
await page.selectOption('#target-language', 'en');
await page.fill('#source-text', 'Komm doch mal vorbei!');
await page.getByRole('button', { name: /^Translate$/ }).click();
const emoji = page.locator('button[aria-label="Show sentiment analysis map"]');
await page.waitForFunction(() => document.querySelectorAll('button[aria-label="Show sentiment analysis map"]').length >= 2, null, { timeout: 60000 });
await page.waitForTimeout(800);
const btn = emoji.nth(1);
await btn.scrollIntoViewIfNeeded();
await page.evaluate(() => scrollBy(0, -260));
await btn.click();
await page.waitForTimeout(900);
const map = btn.locator('xpath=preceding-sibling::div[1]');
const a = await map.boundingBox(), b = await btn.boundingBox();
const pad = 14;
const x = Math.min(a.x, b.x) - pad, y = a.y - pad;
const clip = { x, y, width: Math.max(a.x + a.width, b.x + b.width) + pad - x, height: b.y + b.height + pad - y };
await page.screenshot({ path: 'demo/sentiment-map.png', clip });
console.log('saved', clip);
await browser.close();
