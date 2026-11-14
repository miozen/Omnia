# Omnia Development Handoff

## Last Updated

2026-11-14T23:25+08:00

## Repository State

- **Current Branch:** `dev`
- **HEAD:** `4063a05` (fix(ruleset): allow exclamation mark in tag whitelist and improve status display)
- **Working Tree:** CLEAN
- **Remote Sync:** Pushed to `origin/dev`

## Development State

- **Current Phase:** Post-v0.1.0 Feature Development — Native Subscription Conversion & Bug Fixes
- **Current Task:** Fixed single ruleset download failure for tags containing exclamation marks (`!`)
- **Last Completed:**
  1. Diagnosed single ruleset download failure on `geosite-category-ai-!cn` and `geosite-geolocation-!cn` (error: `Missing Rule Set tag`).
  2. Fixed POSIX shell pattern whitelist in `/usr/libexec/omnia-runner` (`*[!A-Za-z0-9._!-]*)`), aligning with `ruleset_task.uc` (`safe_shell_arg`) to properly allow exclamation marks (`!`).
  3. Optimized frontend `rulesets.js` `pollRulesetDownloadOne` to retain `downloadingTag` before status text rendering, ensuring error messages consistently report the target tag.
  4. Validated tag pattern filtering with test cases (valid tags, tags with `!`, invalid/injection strings).
  5. Verified all JS syntax checks (`node --check`) and UI behavior tests (`panel-behavior.cjs`, `subscription-ui.cjs`).
  6. Verified JSON configurations.

## Uncommitted Work

None once committed.

## Validation Performed

- OpenWrt rootfs container tests via `tests/run-all-convert-tests.sh`:
  - `tests/convert-step1.uc` PASS
  - `tests/convert-step2-uri.uc` PASS
  - `tests/convert-step3-singbox.uc` PASS
  - `tests/convert-step4-producer.uc` PASS
  - `tests/convert-step5-pipeline.uc` PASS
  - `tests/convert-step6-7-integration.uc` PASS
  - `tests/subscription-fallback-security.uc` PASS
  - `tests/convert-step-m2-clash.uc` PASS
  - `tests/convert-step-m2-operators.uc` PASS
  - `tests/convert-step-m2-traffic.uc` PASS
  - `tests/convert-step-m2-integration.uc` PASS
  - `tests/generator-dedicated-dns.uc` PASS
  - `tests/convert-step-m4-local-and-script.uc` PASS
  - UCode syntax compilation on all modules (`ucode -c,module`) PASS
- Subscription refresh integration test (`tests/run-subscription-integration.sh`) PASS.
- Full CI static suite (`tests/ci-static.sh`) PASS via Node.js v22.
- `git diff --check` passed with 0 errors.

## Validation Pending

- Package assembly (IPK/APK) and real device or OpenWrt 25.12.x VM acceptance before final master merge.

## Known Issues / Blockers

None. Native subscription conversion (v1.5) backend and frontend capabilities are fully implemented and verified.

## Exact Next Action

1. Build IPK package manually on `dev` branch.
2. User deploys and tests IPK on real OpenWrt hardware.
3. Upon real device confirmation, proceed with merge from `dev` to `master`.

## Cross-machine Ready

**YES** — Committed and pushed to `origin/dev`. Working tree is CLEAN.
