import { chromium } from "playwright";

// Drives the mobile-web build to verify tap-to-add and long-press-to-delete
// against the live tRPC backend. Run with both dev servers up:
//   web   → http://localhost:3000
//   expo  → http://localhost:8082
//
// Uses real touch events (not mouse), because react-native-web's Pressable only
// distinguishes press vs. long-press under the touch responder — exactly the
// path native uses. A mouse hold collapses to onPress on web.
const url = process.env.MOBILE_URL ?? "http://localhost:8082";
const outDir = process.argv[2] ?? ".";

const browser = await chromium.launch();
const context = await browser.newContext({ hasTouch: true });
const page = await context.newPage();
await page.setViewportSize({ width: 900, height: 1000 });
const cdp = await context.newCDPSession(page);

page.on("pageerror", (err) => console.log("[pageerror]", err.message));
page.on("requestfailed", (req) =>
  console.log("[requestfailed]", req.url(), req.failure()?.errorText),
);

await page.goto(url, { waitUntil: "domcontentloaded" });

const statusLocator = page.getByText(/points ·/);
await statusLocator.waitFor({ timeout: 30_000 });

const countFromStatus = async () => {
  const text = await statusLocator.textContent();
  const m = text?.match(/(\d+)\s+points/);
  return m ? Number(m[1]) : NaN;
};

const svg = page.locator("svg").first();
await svg.waitFor({ timeout: 10_000 });
const box = await svg.boundingBox();
if (!box) throw new Error("no svg bounding box");
const at = (fx, fy) => ({
  x: box.x + box.width * fx,
  y: box.y + box.height * fy,
});

const settle = () => page.waitForTimeout(800);

const touchTap = async ({ x, y }) => {
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await page.waitForTimeout(60);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
};

const touchLongPress = async ({ x, y }) => {
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await page.waitForTimeout(600); // exceed delayLongPress (350ms)
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
};

const start = await countFromStatus();
console.log("initial points:", start);

// --- tap-to-add: three taps at distinct spots ---
const spots = [at(0.3, 0.3), at(0.7, 0.35), at(0.5, 0.7)];
for (const s of spots) {
  await touchTap(s);
  await settle();
}
const afterAdd = await countFromStatus();
console.log("after 3 taps:", afterAdd);
await page.screenshot({ path: `${outDir}/mobile-after-add.png` });

// --- long-press-to-delete: hold on the last spot we added ---
await touchLongPress(at(0.5, 0.7));
await settle();
const afterDelete = await countFromStatus();
console.log("after long-press delete:", afterDelete);
await page.screenshot({ path: `${outDir}/mobile-after-delete.png` });

await browser.close();

const addOk = afterAdd === start + 3;
const delOk = afterDelete === afterAdd - 1;
console.log(JSON.stringify({ start, afterAdd, afterDelete, addOk, delOk }));
if (!addOk || !delOk) {
  console.error("FAIL: counts did not change as expected");
  process.exit(1);
}
console.log("PASS: tap-to-add and long-press-to-delete both work");
