# Research access: server-side shared-passcode authentication

The old Research Mode gate compared a SHA-256 hash **in the browser**, with the hash
and the whole `research/` bundle shipped to every visitor. That is now removed. Access
to the research application is enforced by a Node backend; the research files are never
uploaded to the static distribution.

## Layout

| Path | Role |
| --- | --- |
| `index.html`, `img/`, `videos/`, `sandbox/level3-bilateral/` | Public FTHUE Level 3–6 app. Static, no login. |
| `research/` | Protected research app. Served **only** by the backend after login. Never copied into `dist/public`. |
| `server/research-auth-server.js` | Auth backend (port 5000, Node built-ins only). |
| `server/auth.config.json` | scrypt salt + hash of the shared passcode. No plaintext. |
| `server/generate-passcode.mjs` | Generates a new passcode; prints plaintext once to stdout, writes hash only. |
| `scripts/build-dist.sh` | Deterministic build of `dist/public` with hard exclusion guards. |
| `tests/research-auth.test.mjs` | Security test suite. |

## Commands

```bash
# 1. Build the public static distribution (dist/public)
bash scripts/build-dist.sh

# 2. Start the auth backend (port 5000)
node server/research-auth-server.js
#    Optional: RESEARCH_SESSION_SECRET=<32+ random chars> keeps sessions valid across restarts
#    Optional: RESEARCH_PUBLIC_URL=https://<site> for the "back to public app" bridge in local runs

# 3. Rotate the shared passcode (prints the new plaintext exactly once)
node server/generate-passcode.mjs

# 4. Tests
RESEARCH_TEST_PASSCODE='<passcode>' node --test tests/research-auth.test.mjs   # auth + dist hygiene
node sandbox/level3-bilateral/Level3BilateralDataCollector.test.js
node sandbox/level3-bilateral/Level3BilateralSandbox.test.js
( cd dist/public && python3 -m http.server 4173 & ) && \
  node sandbox/level4-6-technical-validation/run-level4-6-technical-validation.mjs http://127.0.0.1:4173
```

Deploy/publish uses `dist_path=dist/public`, `run_command="node server/research-auth-server.js"`, `port=5000`.
The Research Mode button in `index.html` contains the literal `__PORT_5000__`, which the
deploy/publish pipeline rewrites to the proxied backend origin.

## Security model

- **Passcode**: 4 words + 5 base32 characters (~53 bits). Verified server-side with
  `crypto.scrypt` (N=32768, r=8, p=1) against a 16-byte random salt; comparison is
  `crypto.timingSafeEqual`. The plaintext exists only in the operator's hands.
- **Session**: HMAC-SHA256-signed token `base64url(payload).base64url(sig)` carrying
  `iat`, `exp` (8 h default) and a random `sid`. Verified server-side on every request;
  signature comparison is constant time. Delivered in cookie
  `__Host-ych_research_session` with `Secure; HttpOnly; SameSite=Strict; Path=/` and no
  `Domain`. No `localStorage` / `sessionStorage` is used for auth.
- **Brute force**: 5 failed attempts per IP per 10-minute window → 15-minute lockout
  (HTTP 429 + `Retry-After`); a global counter throttles distributed guessing. Login
  bodies are capped at 2 KB. All failures return one generic bilingual message.
- **Denial semantics**: unauthenticated document navigation to `/research/...` → 303 to
  `/research/login?next=...`; unauthenticated JS/CSS/JSON fetches → 401 JSON. Path
  traversal outside `research/` is rejected.
- **Headers** on every response: `Cache-Control: no-store`, `X-Content-Type-Options:
  nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: SAMEORIGIN`,
  `Permissions-Policy`, and a CSP with `default-src 'self'`, `script-src 'self'`,
  `style-src 'self' 'unsafe-inline'` (research pages use inline `style=` attributes),
  `object-src 'none'`, `form-action 'self'`, `frame-ancestors 'self'`.
- **MediaPipe/CDN**: the public app (which loads MediaPipe from a CDN) is static and is
  not subject to this CSP. The research pages load no third-party resources, so the
  strict CSP does not break them. Research Mode opens the backend in a new top-level tab,
  so `frame-ancestors 'self'` never blocks the preview iframe.

## Known limitations

- One shared passcode for the whole team: no per-user identity, no audit trail of who
  logged in, and rotation requires redistributing the passcode.
- Without `RESEARCH_SESSION_SECRET`, the signing key is regenerated at boot, so a restart
  logs everyone out. There is no server-side session revocation list; logout clears the
  cookie but a stolen cookie stays valid until `exp`.
- Rate limiting is in-memory and per process, keyed on `X-Forwarded-For` when present, so
  a spoofed/rotating client IP can widen the attempt budget (the global counter is the
  backstop). Set `RESEARCH_TRUST_PROXY=0` when not behind a trusted proxy.
- The login form has no CSRF token; `SameSite=Strict` plus `form-action 'self'` are the
  mitigations. Logout is exposed on both POST and GET for usability.
- Research data itself is still handled client-side by the research app (download-before-
  leaving); this change controls access only, not storage or transport of study data.
