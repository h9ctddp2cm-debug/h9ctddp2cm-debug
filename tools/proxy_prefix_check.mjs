// Simulates the deploy/publish topology: static site at <origin>/ and the auth
// backend proxied at <origin>/port/5000/*, to prove every backend link and
// redirect survives the prefix. Requires the backend on :5000 and dist/public
// on :4173. Usage: NODE_PATH=... node tools/proxy_prefix_check.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const PREFIX = '/port/5000';

// Reproduce the upload-time rewrite of the __PORT_5000__ sentinel into the
// proxied backend path, which deploy_website/publish_website perform on S3.
const DIST = path.resolve('dist/public');
const STAGE = path.resolve('dist/proxy-check');
fs.rmSync(STAGE, { recursive: true, force: true });
fs.cpSync(DIST, STAGE, { recursive: true });
const stagedIndex = path.join(STAGE, 'index.html');
fs.writeFileSync(stagedIndex, fs.readFileSync(stagedIndex, 'utf8').replaceAll('__PORT_5000__', 'port/5000'));

function pipe(targetPort, targetPath, req, res) {
  const proxied = http.request(
    { host: '127.0.0.1', port: targetPort, path: targetPath, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${targetPort}` } },
    (up) => {
      res.writeHead(up.statusCode, up.headers);
      up.pipe(res);
    }
  );
  proxied.on('error', () => { res.writeHead(502); res.end('bad gateway'); });
  req.pipe(proxied);
}

function serveStatic(req, res) {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.join(STAGE, rel);
  if (!file.startsWith(STAGE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  const ext = path.extname(file);
  const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
    '.png': 'image/png', '.gif': 'image/gif', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' }[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith(PREFIX)) return pipe(5000, req.url.slice(PREFIX.length) || '/', req, res);
  return serveStatic(req, res);
});

await new Promise((r) => server.listen(4180, r));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };

await page.goto('http://127.0.0.1:4180/index.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);
const [popup] = await Promise.all([ctx.waitForEvent('page'), page.click('#btnResearchMode')]);
await popup.waitForLoadState('domcontentloaded');
console.log('research mode ->', popup.url());
if (!popup.url().includes('/port/5000/research/login')) fail('research mode did not open the proxied login');

await popup.fill('#passcode', process.env.RESEARCH_TEST_PASSCODE || 'wrong');
await popup.click('[data-testid="button-research-login"]');
await popup.waitForLoadState('networkidle');
console.log('after login ->', popup.url());
if (!popup.url().endsWith('/port/5000/research/')) fail('login redirect lost the proxy prefix');
if ((await popup.locator('[data-testid="link-step-t0"]').count()) !== 1) fail('research hub did not render');

await popup.click('[data-testid="link-mode-normal"]');
await popup.waitForLoadState('networkidle');
await popup.click('[data-testid="link-step-t0"]');
await popup.waitForLoadState('networkidle');
console.log('assessor ->', popup.url());
if (!popup.url().includes('/port/5000/research/assessor.html')) fail('assessor navigation lost the prefix');
const bg = await popup.evaluate(() => getComputedStyle(document.body).backgroundColor);
if (bg === 'rgba(0, 0, 0, 0)') fail('protected CSS did not load');

await popup.goto('http://127.0.0.1:4180/port/5000/index.html', { waitUntil: 'networkidle' });
await popup.waitForTimeout(500);
console.log('bridge ->', popup.url());
if (!/4180\/index\.html/.test(popup.url())) fail('public bridge did not return to the static site');

await popup.goto('http://127.0.0.1:4180/port/5000/research/researcher.html', { waitUntil: 'networkidle' });
await popup.click('[data-testid="button-research-logout"]');
await popup.waitForLoadState('networkidle');
console.log('after logout ->', popup.url());
if (!popup.url().includes('/port/5000/research/login')) fail('logout redirect lost the prefix');

await popup.goto('http://127.0.0.1:4180/port/5000/research/assessor.html', { waitUntil: 'networkidle' });
if (!popup.url().includes('research/login')) fail('protected page reachable after logout');
console.log('post-logout guard ->', popup.url());

await browser.close();
server.close();
console.log(process.exitCode ? 'PROXY CHECK FAILED' : 'PROXY CHECK PASSED');
