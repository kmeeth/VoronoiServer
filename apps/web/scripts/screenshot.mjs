// Drive the web app with Playwright to capture screenshots that the static
// `playwright screenshot` CLI can't — interactions like keypresses, hover,
// click. Reuse this for any UI change that depends on user input.
//
// Usage:
//   node scripts/screenshot.mjs <output-dir>
//
// Captures three PNGs into <output-dir>:
//   default.png     — page as loaded
//   hover-red.png   — Shift held while hovering canvas-relative (150,150)
//   hover-green.png — Shift held while hovering canvas-relative (600,200)
//
// Assumes dev server is already running at http://localhost:3000 and that
// deterministic state has been seeded.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const outDir = process.argv[2];
if (!outDir) {
  console.error("usage: node scripts/screenshot.mjs <output-dir>");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
const page = await context.newPage();

await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForSelector("canvas");
await page.waitForTimeout(500);

await page.screenshot({ path: join(outDir, "default.png") });

const canvas = await page.locator("canvas").boundingBox();
if (!canvas) throw new Error("canvas not found");

await page.keyboard.down("Shift");
await page.mouse.move(canvas.x + 150, canvas.y + 150);
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, "hover-red.png") });
await page.mouse.move(canvas.x + 600, canvas.y + 200);
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, "hover-green.png") });
await page.keyboard.up("Shift");

await browser.close();
console.log("wrote screenshots to", outDir);
