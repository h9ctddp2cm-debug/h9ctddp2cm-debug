# v114b Security / Ethics Review — clears residual "keepsake" wording from the flowers activity intro text

Date: 2026-09-15 · Branch `feature/level3-bilateral-sandbox` · Marker `v114-20260914-public-no-keepsake-b`

## Rationale
An independent bypass-cache audit of the live public site (department IT, checking service-worker
version, DOM/function absence, `img/cert` 404s, network requests, and `localStorage`) confirmed the
v114 keepsake removal was functionally effective, but flagged one leftover string: the flowers
activity's rules-card/voice-intro data (`ADV_RULES.flowers` — the third bullet line, the `tail`
caption, and the `tts` voice text) still read "完成後可以寫名、簽名，下載作品" ("when you're done you
can write your name, sign, and download your work") in both on-screen and spoken form. Even though
the actual keepsake DOM/logic was already removed in v114, leaving this description in the shipped
public bundle invites exactly the kind of "the code still says X" question the audit raised.

## Investigation
`ADV_RULES[state.theme]` is read once, in `updateRulesForActivity()`, and only `r.lines[0]` (the
first bullet) is ever consumed. A repo-wide search confirmed no code path reads `lines[1]`,
`lines[2]`, `.tail`, or `.tts` from this object (no `.join`/`.forEach`/destructuring use either) —
this text is dead data in **both** the public and the source/research build; it was never rendered
on screen or spoken via TTS. Because it is equally dead in both builds, this release edits the
strings directly rather than adding a `typeof startFlowersKeepsake === 'function'` conditional (as
was done for the two genuinely-reachable v114 strings in `flowersPanel()` and `rewardSmall()`) —
there is no behavioral difference to preserve between builds for this specific text.

## What changed
| Location | Before | After |
| --- | --- | --- |
| `ADV_RULES.flowers.lines[2]` | 完成後可以寫名、簽名，下載作品 | 完成後按「完成作品」結束 |
| `ADV_RULES.flowers.tail` | 此活動不計分，慢慢享受創作。名字只保留在此頁，不會儲存。 | 此活動不計分，慢慢享受創作。 |
| `ADV_RULES.flowers.tts` | ...完成之後可以寫上名字，下載作品。 | ...完成之後按完成作品結束。 |

No DOM, CSS, or control-flow changes — string literals only, in a data object with a single,
unaffected read site (`lines[0]`).

## Version markers
`v114-20260914-public-no-keepsake` → `v114-20260914-public-no-keepsake-b` in `index.html`
(`LEVEL_APP_BUILD`), `service-worker.js` (`CACHE_VERSION`), and `manifest.webmanifest`
(`start_url`). The `?perf=1` HUD label stays `perf v114` (no major-version bump). Nine existing
marker-consistency tests (`v83-positive-reward-latch`, `adaptive-progression`, `language-switch`,
`v102-kungfu-theme-certificate`, `shoulder-flexion-levels`, `v114-public-no-keepsake`,
`tracking-regression`, `v76-patient-visual-cues`, `v82-layout-difficulty-fix`) were sed-bumped to
expect the `-b` suffix; several already used unanchored regexes that would have tolerated the
suffix, but all nine were updated for consistency and to avoid future false negatives.

## Validation
- Node test suite (65 files, four groups) — 587 passed / 3 skipped / 0 failed. (First run of group 3
  had 1 expected dist-gated failure before `dist/public` was rebuilt; rerun after rebuild —
  `tests/v114-public-no-keepsake.test.mjs` 5/5 and the full group 135/135 — was clean.)
- `tools/checkjs.sh` 11 blocks OK, `node --check service-worker.js`, `git diff --check` clean.
- `./scripts/build-dist.sh` → 199 files (unchanged from v114; text-only edit, no file-count impact).
- `rg -c "__qa" dist/public/index.html` → 0.
- Dist verified directly: all three `-b` version markers present; zero occurrences of "留念",
  "寫名、簽名", or "名字只保留在此頁" anywhere in `dist/public/index.html`; `img/cert` still absent.
- Playwright across laptop 1413×653, iPad landscape 1180×820, and iPad portrait 820×1180: public
  landing page loads cleanly on all three, zero `pageerror` / `console.error` events. Because the
  edited text has no reachable UI path (confirmed dead code, see Investigation), QA focused on
  load-time correctness rather than an on-screen shot of the edited copy. Contact sheet:
  `ych_rehab_qa_artifacts/v114b/v114b-qa-contact-sheet.png`.

## Unchanged
Everything from the v114 review remains unchanged: keepsake DOM/logic removal, `flowersFinishApi`
facade and its deliberately-unforbidden `startFlowersKeepsake` identifier, `img/cert` exclusion and
its fail-closed build guard, certificate removal (v113), recording removal (v112), research-mode
gating, privacy constants, calibration blur/segmentation, Level 5 gameplay, handedness-check
default, chopstick `slotRatios`, and theming strings.

## Residual notes
- The same dead-data pattern (`lines[1]`, `tail`, `tts` never read past `lines[0]`) exists for the
  other `ADV_RULES` themes (`cooking`, `mahjong`, `cards`, `laundry`). This release only touches the
  flowers entry, per the scope of the audit finding; the same direct-edit approach (no facade needed)
  would apply if a future audit flags similar stale copy in those themes.
