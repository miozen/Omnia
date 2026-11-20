# Omnia Development Handoff

## Last Updated

2026-11-20T19:00+08:00

## Repository State

- **Current Branch:** `dev`
- **HEAD:** `ad56f87` (committed and pushed)
- **Working Tree:** CLEAN
- **Remote Sync:** Branch `dev` synchronized with remote origin/dev

## Development State

- **Current Phase:** Post-v0.1.0 Stabilization — rpcd CPU Spinlock Fix & Custom Regions
- **Current Task:** Fix tag_contains_keyword infinite loop in generator_util.uc
- **Last Completed:**
  1. Keyword Matching & Anti-Infinite-Loop Fix (`generator_util.uc`):
     - Identified root cause of 100% CPU lockup and Resources page freeze on real hardware: ucode's string `index()` ignores the 3rd `offset` argument, causing `index(tag_upper, kw_upper, start_pos)` to repeatedly match at offset 0 and deadlock in `while` loop whenever a node name contained an embedded keyword substring (e.g., `NETWORK` matching `TW`, `PLUS` matching `US`, `STAR` matching `AR`).
     - Replaced with windowed substring slice `substr(tag_upper, start_pos)` and standard 2-argument `index(sub, kw_upper)`.
     - Strictly guaranteed monotonic advancement of `start_pos`, ensuring complete termination within `tag_len` iterations.
  2. Regression Test Suite (`tests/profile-selectors.uc`):
     - Added test section asserting rejection of embedded keywords (`NETWORK` for `TW`, `PLUS` for `US`, `STAR` for `AR`, `DESIGN` for `SG`, `RUSSIA` for `US`, `BUSINESS` for `US`, `BETWEEN` for `TW`).
     - Added assertions verifying proper matching of isolated / boundary-separated keywords (`IEPL-TW-01`, `US-VIP-01`, `01 US Node`, `SG_01`, `🇹🇼 台湾 01`, `HK`).
     - Added mixed test verifying proper match after a rejected prefix (`NETWORK-TW-01`).
  3. Validation:
     - `bash tests/ci-static.sh`: PASS.
     - `bash tests/run-all-convert-tests.sh`: PASS (all 14 suites + module compilation).
     - `node tests/profile-ui.cjs`, `subscription-ui.cjs`, `overview-ui.cjs`: PASS.

## Validation Performed

- `bash tests/ci-static.sh`: PASS (All UI, static, and workflow suites passed)
- `bash tests/run-all-convert-tests.sh`: PASS (All 14 pure-function, integration, and module compilation suites passed)
- `node tests/profile-ui.cjs; node tests/subscription-ui.cjs; node tests/overview-ui.cjs`: PASS

## Exact Next Action

Deploy on OpenWrt 25.12+ real hardware and verify that opening the Resources page is instantaneous and CPU usage remains normal.

## Cross-machine Ready

**YES** — Working tree clean, all changes committed and pushed to `dev`.
