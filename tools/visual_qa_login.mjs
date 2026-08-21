// Visual QA: research login page + public research-mode entry (desktop + iPad landscape).
// Usage: NODE_PATH=/home/user/workspace/node_modules node tools/visual_qa_login.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';

// QA captures are written OUTSIDE the repository. Visual QA output may contain
// bedside or device-test imagery, so it must never land in a tracked path.
// Override with QA_OUT_DIR when running elsewhere.
const OUT = process.env.QA_OUT_DIR
  || '/home/user/workspace/ych_rehab_qa_artifacts/qa/research-auth';
fs.mkdirSync(OUT, { recursive: true });

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'ipad-landscape', width: 1180, height: 820 },
];

const browser = await chromium.launch();
for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();

  await page.goto('http://127.0.0.1:5000/research/login', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/login-${vp.name}.png` });

  // Error state (generic message) — never types the real passcode.
  await page.fill('#passcode', 'not-the-passcode');
  await page.click('[data-testid="button-research-login"]');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${OUT}/login-error-${vp.name}.png` });

  await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.locator('#btnResearchMode').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/public-research-entry-${vp.name}.png` });

  await ctx.close();
}
await browser.close();
console.log('screenshots written to', OUT);
