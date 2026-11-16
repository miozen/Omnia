# Omnia Development Handoff

## Last Updated

2026-11-16T16:15+08:00

## Repository State

- **Current Branch:** `dev`
- **HEAD:** `dd10071` (fix: resolve profile pillClass exception and handle unrefreshed sources on single refresh)
- **Working Tree:** CLEAN (after commit)
- **Remote Sync:** Pushed to `origin/dev`

## Development State

- **Current Phase:** Post-v0.1.0 Real-Device Acceptance & Bug Fixes
- **Current Task:** Fix UI pillClass exception and single-source refresh fallback for unrefreshed sources
- **Last Completed:**
  1. Fixed UI runtime exception `TypeError: omniaUi.pillClass is not a function`:
     - Added `pillClass`, `pillStyle`, and `paintPill` helpers to `omnia/ui.js` and exported them.
     - Updated `profile.js` to create badge using `omniaUi.pill(...)` and update dynamic states with `omniaUi.paintPill(...)`.
     - Updated `tests/profile-ui.cjs` mock to align with exported methods.
  2. Fixed backend single-source refresh exception `Single-source refresh requires existing snapshot for unselected source: ...`:
     - Added `old_outbounds_for_name` in `subscription_snapshot.uc`.
     - Updated `preserve_unselected_source` in `subscription.uc` to gracefully treat unselected sources without prior snapshots as `not_refreshed` (with 0 nodes) while preserving the security check against orphaned nodes if an unselected source had nodes under a renamed id.
     - Added regression test case to `tests/subscription-refresh-integration.uc`.
  3. Ran all test suites: 13 convert tests (`run-all-convert-tests.sh`), integration test (`run-subscription-integration.sh`), and CI static suite (`tests/ci-static.sh`) all pass with 0 errors.

## Uncommitted Work

None once committed.

## Validation Performed

- OpenWrt rootfs container tests via `tests/run-all-convert-tests.sh`:
  - 13 pure-function and integration test suites: PASS
  - UCode syntax compilation on all modules (`ucode -c,module`): PASS
- Container HTTP integration test via `tests/run-subscription-integration.sh`: PASS
- Python schema validator `tests/validate-profile-schema.py`: PASS
- Frontend profile UI unit test `tests/profile-ui.cjs`: PASS
- Full CI static suite (`tests/ci-static.sh`): PASS
- `git diff --check`: 0 errors

## Validation Pending

- Real device deployment and verification of the fixes.

## Known Issues / Blockers

None.

## Exact Next Action

1. Build IPK package manually on `dev` branch or let GitHub Actions build.
2. User deploys and tests IPK on real OpenWrt hardware / VM.
3. Upon real device confirmation, proceed with merge from `dev` to `master`.

## Cross-machine Ready

**YES** — Committed and pushed to `origin/dev`. Working tree is CLEAN.
