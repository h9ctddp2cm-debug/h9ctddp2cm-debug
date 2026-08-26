#!/usr/bin/env bash
# Deterministic build of the PUBLIC static distribution (dist/public).
#
# dist/public contains ONLY the patient/therapist-facing FTHUE Level 2-7 app.
# It must never contain research/ (served exclusively by the auth backend),
# diagnostic sandboxes, .git, QA artifacts, tools/, progress notes, zip
# archives, node_modules, or any secret/config material.
#
# Usage: bash scripts/build-dist.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist/public"

rm -rf "$ROOT/dist"
mkdir -p "$DIST"

# --- public entry point + media -------------------------------------------
cp "$ROOT/index.html" "$DIST/index.html"
cp "$ROOT/localization.js" "$DIST/localization.js"
cp "$ROOT/level4-three-games-module.js" "$DIST/level4-three-games-module.js"
cp "$ROOT/level4-elbow-calibration.js" "$DIST/level4-elbow-calibration.js"
cp "$ROOT/level4-video-freshness.js" "$DIST/level4-video-freshness.js"
cp "$ROOT/shoulder-flexion-controller.js" "$DIST/shoulder-flexion-controller.js"
cp "$ROOT/fthue-adaptive-progression.js" "$DIST/fthue-adaptive-progression.js"
cp -R "$ROOT/img" "$DIST/img"

# The three Level 4 real-life instructional GIFs must always ship so the guide
# works with no network. They contain no faces, logos or identifiable people.
for gif in level4_bowling_real_life.gif level4_buspay_real_life.gif level4_mahjongwash_real_life.gif; do
  if [ ! -f "$DIST/img/advanced/$gif" ]; then
    echo "BUILD FAILED: missing Level 4 guide asset img/advanced/$gif" >&2
    exit 1
  fi
done
cp "$ROOT/manifest.webmanifest" "$DIST/manifest.webmanifest"
cp "$ROOT/image-sources.json" "$DIST/image-sources.json"
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

# Research Mode depends on the authenticated local backend. The static
# GitHub Pages/offline release must not expose a dead localhost link or allow
# an unauthenticated intervention deep link.
perl -0pi -e 's#\s*<!-- PUBLIC_BUILD_REMOVE_START:.*?PUBLIC_BUILD_REMOVE_END -->\s*#\n#gs' "$DIST/index.html"
perl -0pi -e 's#\s*/\* PUBLIC_BUILD_REMOVE_START:.*?PUBLIC_BUILD_REMOVE_END \*/\s*#\n#gs' "$DIST/index.html"
if grep -Eq '__PORT_5000__|localhost:5000|btnResearchMode|applyInterventionDeepLink|role=.intervention|window\.__qa|window\.advanceTime|qaSyntheticHand|render_game_to_text' "$DIST/index.html"; then
  echo "BUILD FAILED: research or QA-only entry remains in dist/public" >&2
  exit 1
fi

# --- hard exclusion guard ---------------------------------------------------
fail() { echo "BUILD FAILED: $1" >&2; exit 1; }

if [ -e "$DIST/research" ]; then fail "research/ leaked into dist/public"; fi
if [ -e "$DIST/sandbox" ]; then fail "diagnostic sandbox leaked into dist/public"; fi
if find "$DIST" \( -name '*.test.js' -o -name '*.R' -o -name 'README.md' \
  -o -name '*.zip' -o -name 'auth.config.json' -o -name '.git' \
  -o -name '*.py' -o -name 'node_modules' \) | grep -q .; then
  fail "excluded artifact found in dist/public"
fi

# QA and local review artifacts live outside the repository entirely; assert that
# neither the source tree nor the build output can carry them.
if [ -e "$ROOT/qa" ]; then
  fail "qa/ exists inside the repository - QA artifacts belong in ../ych_rehab_qa_artifacts/"
fi
if find "$DIST" -name 'qa' -o -name 'user-recordings' -o -name '*-recording-recheck' | grep -q .; then
  fail "QA capture path leaked into dist/public"
fi

for banned in research assessor.html researcher.html intervention.html mode.js research-common.js qa; do
  if find "$DIST" -name "$banned" | grep -q .; then fail "banned path $banned in dist/public"; fi
done

if grep -rIl "crypto.subtle.digest" "$DIST" >/dev/null 2>&1; then
  fail "client-side password hashing still present in dist/public"
fi

# Make every static release file readable by the web server and ZIP users,
# regardless of restrictive source-file permissions.
chmod -R a+rX "$DIST"

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
