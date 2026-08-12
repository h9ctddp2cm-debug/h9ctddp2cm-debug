'use strict';
/**
 * Research access backend for the YCH FTHUE rehabilitation app.
 *
 * Responsibilities
 *  - Serve the shared-passcode login page at /research/login.
 *  - Verify the passcode server-side against a slow salted scrypt hash
 *    (server/auth.config.json). No plaintext passcode exists in this repo.
 *  - Serve every file under research/ only to holders of a valid signed,
 *    expiring session cookie (__Host- prefixed, Secure, HttpOnly, SameSite=Strict).
 *  - Public FTHUE Level 3-6 content is NOT served here; it is static and lives
 *    in dist/public (S3). /index.html on this backend only bridges back to it.
 *
 * Dependencies: Node built-ins only.
 */

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const RESEARCH_DIR = path.join(PROJECT_ROOT, 'research');
const CONFIG_PATH = process.env.RESEARCH_AUTH_CONFIG || path.join(__dirname, 'auth.config.json');

const PORT = Number(process.env.PORT || process.env.RESEARCH_PORT || 5000);
const HOST = process.env.HOST || '0.0.0.0';

const COOKIE_NAME = '__Host-ych_research_session';
const SESSION_TTL_MS = Number(process.env.RESEARCH_SESSION_TTL_MS || 8 * 60 * 60 * 1000);
const MAX_BODY_BYTES = 2048;

// Brute-force resistance
const ATTEMPT_WINDOW_MS = Number(process.env.RESEARCH_ATTEMPT_WINDOW_MS || 10 * 60 * 1000);
const MAX_ATTEMPTS = Number(process.env.RESEARCH_MAX_ATTEMPTS || 5);
const LOCKOUT_MS = Number(process.env.RESEARCH_LOCKOUT_MS || 15 * 60 * 1000);
const GLOBAL_MAX_ATTEMPTS = Number(process.env.RESEARCH_GLOBAL_MAX_ATTEMPTS || 60);

const GENERIC_LOGIN_ERROR = '登入失敗，請重試。 Login failed. Check the passcode and try again.';
const LOCKOUT_ERROR = '嘗試次數過多，請稍後再試。 Too many attempts. Try again later.';

// ---------------------------------------------------------------------------
// Config + session secret
// ---------------------------------------------------------------------------
function loadAuthConfig() {
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  if (!raw.saltHex || !raw.hashHex) throw new Error('auth.config.json missing saltHex/hashHex');
  if (raw.passcode || raw.plaintext) throw new Error('auth.config.json must never contain plaintext');
  return raw;
}

const AUTH = loadAuthConfig();

// Signing key: stable across restarts when RESEARCH_SESSION_SECRET is provided,
// otherwise ephemeral (all sessions invalidated on restart).
const SESSION_SECRET = process.env.RESEARCH_SESSION_SECRET
  ? Buffer.from(process.env.RESEARCH_SESSION_SECRET, 'utf8')
  : crypto.randomBytes(32);

// ---------------------------------------------------------------------------
// Crypto helpers
// ---------------------------------------------------------------------------
function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length) {
    // Still burn a comparison to keep timing flat.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyPasscode(candidate, cb) {
  const p = AUTH.params || {};
  crypto.scrypt(
    String(candidate).normalize('NFKC'),
    Buffer.from(AUTH.saltHex, 'hex'),
    p.keylen || 32,
    { N: p.N || 1 << 15, r: p.r || 8, p: p.p || 1, maxmem: p.maxmem || 96 * 1024 * 1024 },
    (err, derived) => {
      if (err) return cb(err, false);
      cb(null, timingSafeEqualStr(derived.toString('hex'), AUTH.hashHex));
    }
  );
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(str) {
  return Buffer.from(String(str).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function signSession(payloadObj) {
  const payload = b64url(JSON.stringify(payloadObj));
  const sig = b64url(crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest());
  return `${payload}.${sig}`;
}

function verifySession(token) {
  if (typeof token !== 'string' || token.length > 1024) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = b64url(crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest());
  if (!timingSafeEqualStr(sig, expected)) return null;
  let data;
  try {
    data = JSON.parse(fromB64url(payload).toString('utf8'));
  } catch {
    return null;
  }
  if (!data || data.v !== 1 || typeof data.exp !== 'number') return null;
  if (Date.now() >= data.exp) return null;
  return data;
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
const attempts = new Map(); // ip -> { count, windowStart, lockedUntil }
let globalAttempts = { count: 0, windowStart: Date.now() };

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff && process.env.RESEARCH_TRUST_PROXY !== '0') {
    const first = String(xff).split(',')[0].trim();
    if (first) return first;
  }
  return req.socket.remoteAddress || 'unknown';
}

function lockState(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec) return { locked: false, retryAfterMs: 0 };
  if (rec.lockedUntil && rec.lockedUntil > now) {
    return { locked: true, retryAfterMs: rec.lockedUntil - now };
  }
  if (rec.lockedUntil && rec.lockedUntil <= now) {
    attempts.delete(ip);
    return { locked: false, retryAfterMs: 0 };
  }
  if (now - rec.windowStart > ATTEMPT_WINDOW_MS) {
    attempts.delete(ip);
    return { locked: false, retryAfterMs: 0 };
  }
  return { locked: false, retryAfterMs: 0 };
}

function globalThrottled() {
  const now = Date.now();
  if (now - globalAttempts.windowStart > ATTEMPT_WINDOW_MS) {
    globalAttempts = { count: 0, windowStart: now };
  }
  return globalAttempts.count >= GLOBAL_MAX_ATTEMPTS;
}

function recordFailure(ip) {
  const now = Date.now();
  globalAttempts.count += 1;
  const rec = attempts.get(ip);
  if (!rec || now - rec.windowStart > ATTEMPT_WINDOW_MS) {
    attempts.set(ip, { count: 1, windowStart: now, lockedUntil: 0 });
    return;
  }
  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) rec.lockedUntil = now + LOCKOUT_MS;
}

function clearFailures(ip) {
  attempts.delete(ip);
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of attempts) {
    const expired = (rec.lockedUntil ? rec.lockedUntil : rec.windowStart + ATTEMPT_WINDOW_MS) < now;
    if (expired) attempts.delete(ip);
  }
}, 60_000).unref?.();

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  `frame-ancestors ${process.env.RESEARCH_FRAME_ANCESTORS || "'self'"}`,
].join('; ');

function baseHeaders(extra) {
  return Object.assign(
    {
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      Expires: '0',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'SAMEORIGIN',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), payment=()',
      'Content-Security-Policy': CSP,
    },
    extra || {}
  );
}

function sessionCookie(token, maxAgeSec) {
  return [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'Secure',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSec}`,
  ].join('; ');
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

function send(res, status, body, headers) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body || '', 'utf8');
  res.writeHead(status, baseHeaders(Object.assign({ 'Content-Length': buf.length }, headers)));
  res.end(buf);
}

function readBody(req, res, cb) {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > MAX_BODY_BYTES) {
    send(res, 413, 'Payload too large', { 'Content-Type': 'text/plain; charset=utf-8' });
    req.destroy();
    return;
  }
  let size = 0;
  const chunks = [];
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      send(res, 413, 'Payload too large', { 'Content-Type': 'text/plain; charset=utf-8' });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (res.writableEnded) return;
    cb(Buffer.concat(chunks).toString('utf8'));
  });
  req.on('error', () => {});
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

function isHtmlNavigation(req) {
  const accept = String(req.headers.accept || '');
  const dest = String(req.headers['sec-fetch-dest'] || '');
  if (dest) return dest === 'document' || dest === 'iframe';
  return accept.includes('text/html');
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])
  );
}

// The backend is served under an opaque proxy prefix (<site>/port/5000) in
// deploy/publish, so every Location header and link must be prefix-relative.
function relativeLocation(fromPathname, targetPathname) {
  const fromDir = path.posix.dirname(fromPathname.endsWith('/') ? fromPathname + 'index' : fromPathname);
  const rel = path.posix.relative(fromDir, targetPathname);
  return rel === '' ? './' : rel;
}

function safeNext(raw) {
  if (typeof raw !== 'string' || !raw) return '/research/';
  if (!raw.startsWith('/research/')) return '/research/';
  if (raw.includes('//') || raw.includes('\\') || raw.includes('..')) return '/research/';
  return raw;
}

function loginPage(errorMessage, nextPath) {
  const err = errorMessage
    ? `<p class="err" role="alert" data-testid="text-login-error">${escapeHtml(errorMessage)}</p>`
    : '<p class="err" role="alert" data-testid="text-login-error"></p>';
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<title>研究模式登入｜Pilot Study Login</title>
<style>
  :root{ --teal:#1a6b5a; --teal-dark:#12483d; --border:#dcd6cc; --text:#241f1a; --muted:#6b6258; --red:#b3261e; }
  *{ box-sizing:border-box; }
  body{ margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    padding:32px 18px; background:#f4efe7; color:var(--text);
    font:400 16px/1.55 -apple-system,'PingFang TC','Noto Sans TC','Microsoft JhengHei',sans-serif; }
  .card{ width:100%; max-width:460px; padding:34px 30px 30px; background:#fff; border:1px solid var(--border);
    border-radius:20px; box-shadow:0 18px 46px rgba(18,72,61,.10); }
  .mark{ display:flex; align-items:center; gap:10px; margin-bottom:20px; color:var(--teal-dark); }
  .mark svg{ width:34px; height:34px; }
  .mark span{ font-size:13px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
  h1{ margin:0 0 6px; font-size:25px; line-height:1.25; color:var(--teal-dark); }
  .lead{ margin:0 0 22px; color:var(--muted); font-size:14px; }
  label{ display:block; margin-bottom:7px; font-size:14px; font-weight:800; }
  input[type=password]{ width:100%; min-height:50px; padding:12px 14px; border:1.5px solid var(--border);
    border-radius:12px; background:#fdfcfa; font:700 17px/1.2 inherit; letter-spacing:.03em; }
  input[type=password]:focus{ outline:3px solid rgba(26,107,90,.20); border-color:var(--teal); }
  button{ width:100%; min-height:52px; margin-top:18px; border:0; border-radius:12px; background:var(--teal);
    color:#fff; font:800 17px/1 inherit; cursor:pointer; }
  button:hover{ background:var(--teal-dark); }
  .err{ min-height:22px; margin:12px 0 0; color:var(--red); font-size:14px; font-weight:800; }
  .foot{ margin:22px 0 0; padding-top:16px; border-top:1px solid var(--border); color:var(--muted); font-size:12.5px; }
  .foot a{ color:var(--teal-dark); font-weight:700; }
</style>
</head>
<body>
  <main class="card">
    <div class="mark">
      <svg viewBox="0 0 32 32" fill="none" aria-label="Yan Chai rehabilitation research" role="img">
        <rect x="2.5" y="2.5" width="27" height="27" rx="8" stroke="currentColor" stroke-width="2.2"/>
        <path d="M10 21V13.5a6 6 0 0 1 12 0V21" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M16 21v-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
      </svg>
      <span>Pilot Study Access</span>
    </div>
    <h1>研究模式登入</h1>
    <p class="lead">此區域只供研究團隊使用，需輸入共用通行碼。<br>Restricted research area. Shared passcode required.</p>
    <!-- Relative URLs only: the backend is proxied under <site>/port/5000/ when deployed. -->
    <form method="POST" action="login" autocomplete="off" data-testid="form-research-login">
      <input type="hidden" name="next" value="${escapeHtml(nextPath || '/research/')}">
      <label for="passcode">通行碼 Passcode</label>
      <input id="passcode" name="passcode" type="password" autocomplete="current-password"
        maxlength="128" required autofocus data-testid="input-research-passcode">
      ${err}
      <button type="submit" data-testid="button-research-login">登入 Sign in</button>
    </form>
    <p class="foot">請勿在此輸入病人姓名或病歷號碼。通行碼由研究負責人分發，切勿轉發。<br>
      <a href="../index.html" data-testid="link-back-public">← 返回公開版遊戲 Back to public app</a></p>
  </main>
</body>
</html>`;
}

// Bridge back to the public static site. The backend is proxied under
// <origin>/port/5000/... by deploy_website / publish_website, so stripping that
// prefix from the current path yields the static site root on S3.
function publicBridgePage() {
  return `<!DOCTYPE html>
<html lang="zh-Hant"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>返回公開版｜Back to public app</title>
<style>body{margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;
background:#f4efe7;color:#12483d;font:700 16px/1.5 -apple-system,'PingFang TC',sans-serif;text-align:center;padding:24px}
a{color:#1a6b5a}</style>
<script src="research/bridge.js" defer></script>
</head><body><p>返回公開版遊戲… Returning to the public app…<br>
<span style="font-weight:400;font-size:14px">如未自動跳轉，請開啟公開版網址。If you are not redirected, open the public app URL.</span><br>
<a href="/research/login">研究模式登入 Research login</a></p></body></html>`;
}

const PUBLIC_FALLBACK_URL = process.env.RESEARCH_PUBLIC_URL || '';
const BRIDGE_JS = `(function(){
  var p = window.location.pathname;
  var marker = '/port/${PORT}';
  var i = p.indexOf(marker);
  var target = '';
  if (i >= 0) {
    target = p.slice(0, i) + '/index.html';
  } else if (${JSON.stringify(PUBLIC_FALLBACK_URL)}) {
    target = ${JSON.stringify(PUBLIC_FALLBACK_URL)}.replace(/\\/$/, '') + '/index.html';
  }
  if (!target) return; // standalone/local run: avoid redirect loop, show links instead
  window.location.replace(target + window.location.search + window.location.hash);
})();
`;

const LOGOUT_WIDGET = `
<form method="POST" action="logout" data-testid="form-research-logout"
  style="position:fixed;right:14px;bottom:14px;z-index:9999;margin:0">
  <button type="submit" data-testid="button-research-logout"
    style="min-height:40px;padding:9px 16px;border:1px solid #12483d;border-radius:999px;background:#12483d;color:#fff;font:800 13px/1 inherit;cursor:pointer">
    登出 Log out</button>
</form>
`;

// ---------------------------------------------------------------------------
// Static file serving (protected)
// ---------------------------------------------------------------------------
function resolveResearchFile(urlPath) {
  let rel = decodeURIComponent(urlPath.replace(/^\/research\/?/, ''));
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  if (rel.includes('\0')) return null;
  const target = path.resolve(RESEARCH_DIR, rel);
  const withinDir = target === RESEARCH_DIR || target.startsWith(RESEARCH_DIR + path.sep);
  if (!withinDir) return null;
  return target;
}

function serveProtectedFile(req, res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        send(res, 500, 'Server error', { 'Content-Type': 'text/plain; charset=utf-8' });
        return;
      }
      let body = data;
      if (ext === '.html') {
        const html = data.toString('utf8');
        body = Buffer.from(
          html.includes('</body>') ? html.replace('</body>', `${LOGOUT_WIDGET}</body>`) : html + LOGOUT_WIDGET,
          'utf8'
        );
      }
      send(res, 200, body, { 'Content-Type': type });
    });
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
function handleLoginPost(req, res, ip) {
  const state = lockState(ip);
  if (state.locked || globalThrottled()) {
    send(res, 429, loginPage(LOCKOUT_ERROR, '/research/'), {
      'Content-Type': 'text/html; charset=utf-8',
      'Retry-After': String(Math.ceil((state.retryAfterMs || LOCKOUT_MS) / 1000)),
    });
    return;
  }
  readBody(req, res, (raw) => {
    const params = new URLSearchParams(raw);
    const passcode = params.get('passcode') || '';
    const next = safeNext(params.get('next'));
    if (!passcode || passcode.length > 128) {
      recordFailure(ip);
      send(res, 401, loginPage(GENERIC_LOGIN_ERROR, next), { 'Content-Type': 'text/html; charset=utf-8' });
      return;
    }
    verifyPasscode(passcode, (err, ok) => {
      if (err || !ok) {
        recordFailure(ip);
        const after = lockState(ip);
        const status = after.locked ? 429 : 401;
        send(res, status, loginPage(after.locked ? LOCKOUT_ERROR : GENERIC_LOGIN_ERROR, next), {
          'Content-Type': 'text/html; charset=utf-8',
        });
        return;
      }
      clearFailures(ip);
      const now = Date.now();
      const token = signSession({
        v: 1,
        iat: now,
        exp: now + SESSION_TTL_MS,
        sid: crypto.randomBytes(16).toString('hex'),
      });
      res.writeHead(
        303,
        baseHeaders({
          Location: relativeLocation('/research/login', next),
          'Set-Cookie': sessionCookie(token, Math.floor(SESSION_TTL_MS / 1000)),
          'Content-Length': 0,
        })
      );
      res.end();
    });
  });
}

function handleLogout(req, res) {
  res.writeHead(
    303,
    baseHeaders({
      Location: relativeLocation('/research/logout', '/research/login'),
      'Set-Cookie': `${COOKIE_NAME}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`,
      'Content-Length': 0,
    })
  );
  res.end();
}

function requestHandler(req, res) {
  let url;
  try {
    url = new URL(req.url, 'http://internal');
  } catch {
    send(res, 400, 'Bad request', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }
  const pathname = url.pathname.replace(/\/{2,}/g, '/');
  const method = req.method || 'GET';
  const ip = clientIp(req);
  const cookies = parseCookies(req.headers.cookie);
  const session = verifySession(cookies[COOKIE_NAME]);

  if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') {
    send(res, 405, 'Method not allowed', { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD, POST' });
    return;
  }

  if (pathname === '/healthz') {
    send(res, 200, JSON.stringify({ ok: true }), { 'Content-Type': 'application/json; charset=utf-8' });
    return;
  }

  if (pathname === '/research/bridge.js') {
    send(res, 200, BRIDGE_JS, { 'Content-Type': 'text/javascript; charset=utf-8' });
    return;
  }

  if (pathname === '/research/login') {
    if (method === 'POST') return handleLoginPost(req, res, ip);
    if (session) {
      res.writeHead(
        303,
        baseHeaders({
          Location: relativeLocation('/research/login', safeNext(url.searchParams.get('next'))),
          'Content-Length': 0,
        })
      );
      res.end();
      return;
    }
    send(res, 200, loginPage('', safeNext(url.searchParams.get('next'))), {
      'Content-Type': 'text/html; charset=utf-8',
    });
    return;
  }

  if (pathname === '/research/logout') {
    return handleLogout(req, res);
  }

  if (pathname === '/research' || pathname.startsWith('/research/')) {
    if (method === 'POST') {
      send(res, 405, 'Method not allowed', { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
      return;
    }
    if (!session) {
      if (isHtmlNavigation(req)) {
        const next = encodeURIComponent(pathname === '/research' ? '/research/' : pathname);
        const loginRel = relativeLocation(pathname, '/research/login');
        res.writeHead(303, baseHeaders({ Location: `${loginRel}?next=${next}`, 'Content-Length': 0 }));
        res.end();
        return;
      }
      send(res, 401, JSON.stringify({ error: 'authentication_required' }), {
        'Content-Type': 'application/json; charset=utf-8',
      });
      return;
    }
    const target = resolveResearchFile(pathname === '/research' ? '/research/' : pathname);
    if (!target) {
      send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
      return;
    }
    return serveProtectedFile(req, res, target);
  }

  if (pathname === '/' || pathname === '/index.html') {
    send(res, 200, publicBridgePage(), { 'Content-Type': 'text/html; charset=utf-8' });
    return;
  }

  send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
}

const server = http.createServer(requestHandler);
server.headersTimeout = 15_000;
server.requestTimeout = 30_000;

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    process.stdout.write(`research auth backend listening on http://${HOST}:${PORT}\n`);
    if (!process.env.RESEARCH_SESSION_SECRET) {
      process.stdout.write('note: ephemeral session key in use; restarting invalidates all sessions\n');
    }
  });
}

module.exports = { server, requestHandler, COOKIE_NAME, PORT };
