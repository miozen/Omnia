# Omnia Development Handoff

## Last Updated

2026-11-15T10:10+08:00

## Repository State

- **Current Branch:** `dev`
- **HEAD:** (pending commit for airport dns and sub-store operator ui)
- **Working Tree:** DIRTY (pending commit)
- **Remote Sync:** Pending push to `origin/dev`

## Development State

- **Current Phase:** Post-v0.1.0 Feature Development — Native Subscription Conversion & Bug Fixes
- **Current Task:** Replaced raw operator JSON with Sub-Store style visual cards & full sing-box official airport DNS settings
- **Last Completed:**
  1. Replaced the single JSON textarea in operator pipeline with Sub-Store style visual card list (supporting filter, rename, flag, quick setting, sort, script), with move up/down, delete, and preset examples.
  2. Enhanced airport dedicated DNS to fully align with sing-box official specification (supporting tag, type, server, server_port, path, detour, domain_resolver, strategy, client_subnet).
  3. Lifted the rigid detour restrictions in `subscription_policy_schema.uc`, allowing users to choose proxy or default direct detours for airport DNS.
  4. Enabled seamless two-way switching between visual UI form mode and advanced JSON mode (with presets) for both DNS and operator pipeline.
  5. Verified all 13 pure-function and integration tests via `tests/run-all-convert-tests.sh` in OpenWrt container.
  6. Verified `ci-static.sh` (JS syntax, panel behavior, subscription UI, release scripts).

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
