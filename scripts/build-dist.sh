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
cp "$ROOT/level4-three-games-module.js" "$DIST/level4-three-games-module.js"
cp "$ROOT/level4-elbow-calibration.js" "$DIST/level4-elbow-calibration.js"
cp -R "$ROOT/img" "$DIST/img"
cp "$ROOT/manifest.webmanifest" "$DIST/manifest.webmanifest"
cp "$ROOT/service-worker.js" "$DIST/service-worker.js"
cp "$ROOT/offline.html" "$DIST/offline.html"
cp -R "$ROOT/icons" "$DIST/icons"
cp -R "$ROOT/vendor" "$DIST/vendor"

# The inline-edit bridge is only for Perplexity's authoring preview. It is not
# required by the standalone clinical build, so remove it from production.
perl -0pi -e 's#<script data-pplx-inline-edit>.*?</script>\s*##s' "$DIST/index.html"
if grep -q 'data-pplx-inline-edit' "$DIST/index.html"; then
  echo "BUILD FAILED: authoring preview bridge remains in dist/public" >&2
  exit 1
fi

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

# Generate the exact same-origin asset inventory consumed by service-worker.js.
# Each item is cached independently so one transient download cannot invalidate
# the full offline installation.
{
  printf 'self.__OFFLINE_ASSETS = [\n'
  find "$DIST" -type f ! -name 'offline-assets.js' \
    -printf '%P\n' | LC_ALL=C sort | sed 's#^#  "./#; s#$#",#'
  printf '];\n'
} > "$DIST/offline-assets.js"

echo "dist/public built: $(find "$DIST" -type f | wc -l) files, $(du -sh "$DIST" | cut -f1)"
