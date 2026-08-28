# v64 Level 6 no duplicate task picker — completion record

Date: 2026-08-27  
Version: `v64-20260827-level6-no-duplicate-task-picker`

## Implemented

- Removed the entire normal Level 6 setup task-selector card: dropdown summary, six task buttons, description, and therapist-details subsection.
- Kept the six activity-library cards as the only public Level 6 task picker in Traditional Chinese and English.
- Added a Level 6 library lock (`level6LockedTheme`) that binds the task/theme pair on card selection and reasserts it before calibration and gameplay.
- Affected-side selection, all other setup controls, calibration back, and game start cannot silently replace the selected task.
- Back to library and re-entering a card establishes the card's matching lock again.
- Preserved all six Level 6 games, tool-specific finger tracking, fixed internal shoulder endpoint, all other levels, and the separate research tool-mode path.
- QA-only task injection and screen-transition helpers remain inside `window.__qa`; the public build strips the full QA block.

## Regression coverage

- Every Level 6 card in both `zh-Hant` and `en`:
  - card opens setup with matching title and instructions;
  - duplicate selector is absent;
  - affected-side selection preserves task/theme;
  - calibration back preserves task/theme;
  - library back/re-entry preserves the selected card;
  - launch starts the same task and interaction engine.
- Technical validator adds six locked-library setup-to-launch checks.
- Existing gesture, tracking, layout, other-level, language, camera, and offline coverage remains enabled.

## Validation results

- Focused Level 6 tests: **36/36 passed**.
- Full Node suite: **263 total; 260 passed; 0 failed; 3 intentional skips**.
- Source technical validator: **157/157 passed**:
  - Level 2: 37
  - Level 3: 21
  - Level 4: 21
  - Level 5: 40
  - Level 6: 38
- Inline JavaScript and module syntax checks passed.
- `git diff --check` passed.
- Rebuilt `dist/public`: **134 files, 83 MB**.
- Public static audit passed:
  - v64 markers align in app, manifest, and service worker;
  - no `level67ToolCard`, `level67ToolOptions`, or `data-level6-task` markup;
  - no `window.__qa`, `window.advanceTime`, or `render_game_to_text` hook;
  - all six Level 6 theme definitions remain.

## iPad Playwright QA

Rebuilt-public QA used normal clicks at:

- 820×1180 portrait
- 1180×820 landscape

Across six cards × two languages × two viewports, **24/24 flows passed** with matching title/instructions, no task selector, no horizontal overflow, and no console/page errors. Affected-side selection and library back/re-entry preserved the selected title. Portrait Traditional Chinese Cloth-Peg Laundry and landscape English Chopstick Dim Sum screenshots were visually inspected; controls were readable, aligned, and unclipped.

Artifacts:

- `/home/user/workspace/ych_rehab_qa_artifacts/v64-level6-no-duplicate-task-picker/qa-inventory.json`
- `/home/user/workspace/ych_rehab_qa_artifacts/v64-level6-no-duplicate-task-picker/ipad-qa-results.json`
- `/home/user/workspace/ych_rehab_qa_artifacts/v64-level6-no-duplicate-task-picker/browser/`
- `/home/user/workspace/ych_rehab_qa_artifacts/v64-level6-no-duplicate-task-picker/source-tech/`
- `/home/user/workspace/ych_rehab_games_advanced/full-node-v64-final.log`

No commit, push, publish, or deployment was performed.
