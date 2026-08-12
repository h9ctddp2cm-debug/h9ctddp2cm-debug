#!/usr/bin/env bash
# Deterministic build of the PUBLIC static distribution (dist/public).
#
# dist/public contains ONLY the patient/therapist-facing FTHUE Level 3-6 app:
#   index.html, img/, sandbox/level3-bilateral runtime files.
# It must never contain research/ (served exclusively by the auth backend),
# .git, QA artifacts, tools/, progress notes, zip archives, node_modules,
# or any secret/config material.
#
# Usage: bash scripts/build-dist.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist/public"

rm -rf "$ROOT/dist"
mkdir -p "$DIST"

# --- public entry point + media -------------------------------------------
cp "$ROOT/index.html" "$DIST/index.html"
cp -R "$ROOT/img" "$DIST/img"

# --- public Level 3 bilateral sandbox (runtime files only) -----------------
mkdir -p "$DIST/sandbox/level3-bilateral"
for f in index.html diagnostic.css diagnosticApp.js \
         Level3BilateralSandbox.js Level3BilateralDataCollector.js \
         TherapistDashboard.js VamsInterfaceOverlay.js; do
  cp "$ROOT/sandbox/level3-bilateral/$f" "$DIST/sandbox/level3-bilateral/$f"
done

# --- hard exclusion guard ---------------------------------------------------
fail() { echo "BUILD FAILED: $1" >&2; exit 1; }

if [ -e "$DIST/research" ]; then fail "research/ leaked into dist/public"; fi
if find "$DIST" \( -name '*.test.js' -o -name '*.R' -o -name 'README.md' \
  -o -name '*.zip' -o -name 'auth.config.json' -o -name '.git' \
  -o -name '*.py' -o -name 'node_modules' \) | grep -q .; then
  fail "excluded artifact found in dist/public"
fi

for banned in research assessor.html researcher.html intervention.html mode.js research-common.js; do
  if find "$DIST" -name "$banned" | grep -q .; then fail "banned path $banned in dist/public"; fi
done

if grep -rIl "crypto.subtle.digest" "$DIST" >/dev/null 2>&1; then
  fail "client-side password hashing still present in dist/public"
fi

echo "dist/public built: $(find "$DIST" -type f | wc -l) files, $(du -sh "$DIST" | cut -f1)"
