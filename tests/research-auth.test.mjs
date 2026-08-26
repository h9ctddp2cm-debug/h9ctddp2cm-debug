/**
 * Automated security tests for the research shared-passcode backend.
 *
 * The plaintext passcode is NEVER stored in this repository. Supply it at run
 * time so the suite can exercise the success paths:
 *
 *   RESEARCH_TEST_PASSCODE='<passcode>' node --test tests/research-auth.test.mjs
 *
 * Without the env var, the success-path tests are skipped and every negative /
 * hardening test still runs.
 *
 * Uses Node built-ins only (node:test, node:assert, fetch).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.RESEARCH_TEST_PORT || 5099);
const BASE = `http://127.0.0.1:${PORT}`;
const COOKIE = '__Host-ych_research_session';
const PASSCODE = process.env.RESEARCH_TEST_PASSCODE || '';
const SECRET = 'test-secret-for-suite-only';

let child;

function get(pathname, opts = {}) {
  return fetch(BASE + pathname, { redirect: 'manual', ...opts });
}

function postForm(pathname, body, opts = {}) {
  return fetch(BASE + pathname, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(opts.headers || {}) },
    body,
  });
}

function cookieValue(res) {
  const raw = res.headers.get('set-cookie') || '';
  const m = raw.match(new RegExp(`${COOKIE}=([^;]*)`));
  return m ? m[1] : '';
}

async function login(passcode, ip = '10.0.0.1') {
  return postForm('/research/login', new URLSearchParams({ passcode }).toString(), {
    headers: { 'X-Forwarded-For': ip },
  });
}

function signWith(secret, payloadObj) {
  const b64 = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const payload = b64(JSON.stringify(payloadObj));
  const sig = b64(crypto.createHmac('sha256', secret).update(payload).digest());
  return `${payload}.${sig}`;
}

before(async () => {
  child = spawn(process.execPath, [path.join(ROOT, 'server', 'research-auth-server.js')], {
    env: {
      ...process.env,
      PORT: String(PORT),
      RESEARCH_SESSION_SECRET: SECRET,
      RESEARCH_MAX_ATTEMPTS: '3',
      RESEARCH_LOCKOUT_MS: '4000',
      RESEARCH_ATTEMPT_WINDOW_MS: '60000',
      RESEARCH_GLOBAL_MAX_ATTEMPTS: '500',
    },
    stdio: 'ignore',
  });
  const deadline = Date.now() + 15000;
  for (;;) {
    try {
      const res = await fetch(`${BASE}/healthz`);
      if (res.ok) break;
    } catch {
      /* retry */
    }
    if (Date.now() > deadline) throw new Error('server did not start');
    await new Promise((r) => setTimeout(r, 200));
  }
});

after(() => {
  if (child) child.kill('SIGTERM');
});

test('login page is publicly reachable and carries hardening headers', async () => {
  const res = await get('/research/login');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /研究模式登入/);
  assert.match(res.headers.get('cache-control') || '', /no-store/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.match(res.headers.get('referrer-policy') || '', /no-referrer/);
  const csp = res.headers.get('content-security-policy') || '';
  assert.match(csp, /frame-ancestors 'self'/);
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
});

test('direct navigation to a protected research page redirects to login', async () => {
  const res = await get('/research/assessor.html', { headers: { Accept: 'text/html' } });
  assert.equal(res.status, 303);
  // Relative (no leading slash) so it survives the <site>/port/5000 proxy prefix.
  assert.equal(res.headers.get('location'), 'login?next=%2Fresearch%2Fassessor.html');
  const body = await res.text();
  assert.equal(body.includes('rs-topbar'), false);
});

test('protected research hub is not served unauthenticated', async () => {
  const res = await get('/research/', { headers: { Accept: 'text/html' } });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), 'login?next=%2Fresearch%2F');
});

test('protected JS and CSS assets return 401 unauthenticated', async () => {
  for (const asset of ['/research/assessor.js', '/research/research.css', '/research/research-common.js']) {
    const res = await get(asset);
    assert.equal(res.status, 401, `${asset} should be 401`);
    const body = await res.text();
    assert.equal(body.includes('function'), false);
    assert.match(body, /authentication_required/);
  }
});

test('path traversal out of research/ is rejected', async () => {
  const res = await get('/research/..%2findex.html', { headers: { Accept: 'text/html' } });
  assert.ok([303, 403, 404].includes(res.status));
});

test('wrong passcode returns a generic error and no session cookie', async () => {
  const res = await login('definitely-not-the-passcode', '10.9.9.1');
  assert.equal(res.status, 401);
  assert.equal(cookieValue(res), '');
  const html = await res.text();
  assert.match(html, /Login failed/);
  assert.equal(/unknown user|no such|passcode length|invalid hash/i.test(html), false);
});

test('oversized POST body is rejected before authentication', async () => {
  const res = await postForm('/research/login', `passcode=${'x'.repeat(5000)}`, {
    headers: { 'X-Forwarded-For': '10.9.9.2' },
  });
  assert.equal(res.status, 413);
});

test('repeated failures trigger per-IP lockout, then recover after the window', async () => {
  const ip = '10.7.7.7';
  const codes = [];
  for (let i = 0; i < 4; i += 1) {
    const res = await login(`wrong-${i}`, ip);
    codes.push(res.status);
    await res.text();
  }
  assert.deepEqual(codes.slice(0, 2), [401, 401]);
  assert.equal(codes.at(-1), 429, 'IP should be locked out after max attempts');
  // Locked out even with a hypothetically correct-looking request.
  const locked = await login('whatever', ip);
  assert.equal(locked.status, 429);
  assert.ok(Number(locked.headers.get('retry-after')) > 0);
  await locked.text();
  await new Promise((r) => setTimeout(r, 4300));
  const recovered = await login('still-wrong', ip);
  assert.equal(recovered.status, 401, 'lockout should expire');
  await recovered.text();
});

test('forged and tampered session cookies are rejected', async () => {
  const forged = signWith('attacker-secret', { v: 1, iat: Date.now(), exp: Date.now() + 60000, sid: 'x' });
  let res = await get('/research/assessor.js', { headers: { Cookie: `${COOKIE}=${forged}` } });
  assert.equal(res.status, 401);

  const valid = signWith(SECRET, { v: 1, iat: Date.now(), exp: Date.now() + 60000, sid: 'x' });
  const tampered = `${valid.split('.')[0]}x.${valid.split('.')[1]}`;
  res = await get('/research/assessor.js', { headers: { Cookie: `${COOKIE}=${tampered}` } });
  assert.equal(res.status, 401);

  res = await get('/research/assessor.js', { headers: { Cookie: `${COOKIE}=not-a-token` } });
  assert.equal(res.status, 401);
});

test('expired but correctly signed session is rejected', async () => {
  const expired = signWith(SECRET, { v: 1, iat: Date.now() - 7200_000, exp: Date.now() - 1000, sid: 'x' });
  const res = await get('/research/assessor.js', { headers: { Cookie: `${COOKIE}=${expired}` } });
  assert.equal(res.status, 401);
});

test('a validly signed session unlocks protected assets', async () => {
  const token = signWith(SECRET, { v: 1, iat: Date.now(), exp: Date.now() + 60000, sid: 'y' });
  const res = await get('/research/research.css', { headers: { Cookie: `${COOKIE}=${token}` } });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /rs-/);
});

test('all emitted links and redirects are proxy-prefix relative', async () => {
  const login = await get('/research/login');
  const html = await login.text();
  assert.match(html, /action="login"/);
  assert.match(html, /href="\.\.\/index\.html"/);
  assert.equal(/action="\/research/.test(html), false);
  const bridge = await get('/index.html');
  const bridgeHtml = await bridge.text();
  assert.match(bridgeHtml, /src="research\/bridge\.js"/);
});

test('public bridge endpoint exposes no research content', async () => {
  const res = await get('/index.html');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /bridge\.js/);
  assert.equal(html.includes('assessor'), false);
});

test('correct passcode logs in, grants access, and logout revokes it', { skip: !PASSCODE }, async () => {
  const res = await login(PASSCODE, '10.5.5.5');
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), './');

  const setCookie = res.headers.get('set-cookie') || '';
  assert.match(setCookie, new RegExp(`^${COOKIE}=`));
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.match(setCookie, /Path=\//);
  assert.match(setCookie, /Max-Age=\d+/);
  assert.equal(/Domain=/i.test(setCookie), false, '__Host- cookies must not set Domain');

  const token = cookieValue(res);
  assert.ok(token.includes('.'));

  const hub = await get('/research/', { headers: { Cookie: `${COOKIE}=${token}`, Accept: 'text/html' } });
  assert.equal(hub.status, 200);
  const hubHtml = await hub.text();
  assert.match(hubHtml, /Pilot Study 資料收集/);
  assert.match(hubHtml, /button-research-logout/);

  const js = await get('/research/assessor.js', { headers: { Cookie: `${COOKIE}=${token}` } });
  assert.equal(js.status, 200);

  const loggedIn = await get('/research/login', { headers: { Cookie: `${COOKIE}=${token}`, Accept: 'text/html' } });
  assert.equal(loggedIn.status, 303);

  const out = await postForm('/research/logout', '', { headers: { Cookie: `${COOKIE}=${token}` } });
  assert.equal(out.status, 303);
  assert.match(out.headers.get('set-cookie') || '', /Max-Age=0/);
});

test('successful login clears the per-IP failure counter', { skip: !PASSCODE }, async () => {
  const ip = '10.6.6.6';
  for (let i = 0; i < 2; i += 1) await (await login(`bad-${i}`, ip)).text();
  const ok = await login(PASSCODE, ip);
  assert.equal(ok.status, 303);
  for (let i = 0; i < 2; i += 1) {
    const res = await login(`bad-again-${i}`, ip);
    assert.equal(res.status, 401, 'counter should have been reset by the success');
    await res.text();
  }
});

// --- distribution hygiene ---------------------------------------------------

test('dist/public contains no research files and no plaintext passcode', { skip: !fs.existsSync(path.join(ROOT, 'dist/public')) }, async () => {
  const dist = path.join(ROOT, 'dist', 'public');
  const files = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else files.push(p);
    }
  })(dist);

  assert.equal(fs.existsSync(path.join(dist, 'research')), false, 'research/ must not ship');
  for (const banned of ['assessor.html', 'assessor.js', 'researcher.html', 'intervention.html', 'mode.js', 'research-common.js', 'research.css', 'auth.config.json']) {
    assert.equal(files.some((f) => path.basename(f) === banned), false, `${banned} must not ship`);
  }
  assert.equal(files.some((f) => f.includes('/.git') || f.includes('node_modules') || f.endsWith('.zip')), false);

  const textFiles = files.filter((f) => /\.(html|js|css|json|txt|md)$/.test(f));
  for (const f of textFiles) {
    const content = fs.readFileSync(f, 'utf8');
    assert.equal(content.includes('crypto.subtle.digest'), false, `${f} still hashes passwords client-side`);
    assert.equal(/35619761ce97f0a1e08220882954ce869ad9c3d411b2bbba529f7f4a7f0c12e6/.test(content), false, `${f} still contains the old hardcoded hash`);
    if (PASSCODE) {
      assert.equal(content.includes(PASSCODE), false, `${f} leaks the plaintext passcode`);
    }
  }
  const indexHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  assert.doesNotMatch(
    indexHtml,
    /__PORT_5000__|localhost:5000|\/research\/login|applyInterventionDeepLink|role=.intervention|window\.__qa|window\.advanceTime|qaSyntheticHand|render_game_to_text/,
  );
  assert.doesNotMatch(indexHtml, /btnResearchMode/);
  assert.equal(
    fs.existsSync(path.join(dist, 'sandbox')),
    false,
    'Public/offline release must exclude research and QA sandbox pages',
  );
});

test('repository source contains no plaintext passcode', { skip: !PASSCODE }, async () => {
  const tracked = [
    'index.html',
    'server/research-auth-server.js',
    'server/generate-passcode.mjs',
    'server/auth.config.json',
    'scripts/build-dist.sh',
    'tests/research-auth.test.mjs',
  ];
  for (const rel of tracked) {
    const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.equal(content.includes(PASSCODE), false, `${rel} leaks the plaintext passcode`);
  }
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'server/auth.config.json'), 'utf8'));
  assert.equal(cfg.algorithm, 'scrypt');
  assert.ok(cfg.params.N >= 16384, 'scrypt cost must stay high');
  assert.equal('passcode' in cfg, false);
});
