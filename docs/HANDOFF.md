# Omnia Development Handoff

## Last Updated

2026-11-14T21:48+08:00

## Repository State

- **Current Branch:** `dev`
- **HEAD:** `ac17013` (feat: integrate native conversion and node processing into LuCI UI)
- **Working Tree:** CLEAN
- **Remote Sync:** Pushed to `origin/dev`

## Development State

- **Current Phase:** Post-v0.1.0 Feature Development — Native Subscription Conversion (Milestones 1-5 Complete)
- **Current Task:** Manual package assembly on `dev` and real hardware testing before master merge
- **Last Completed:**
  1. Updated LuCI frontend model (`subscriptions.js`), ensuring `normalizePolicy` and `collectPolicyFromPage` preserve all native conversion fields (type, subtype, payload, nodes, user_agent, operators, dns, userinfo).
  2. Upgraded subscription source editor drawer (`subscriptions.js`), supporting Remote URL vs Local Nodes, UA presets/custom, payload/form entry, dedicated DNS config, and operator pipeline with quick template buttons.
  3. Integrated instant test and preview (`subscription.uc` -> `subscription_test_source`, `omnia.uc` -> rpcd args schema, `subscriptions.js` -> `testEditorSource`), enabling real-time node preview without saving to snapshot.
  4. Added visual indicators to source matrix table (local node badge, dedicated DNS tag, operator count).
  5. Cleaned up legacy Sub-Store text across frontend.
  6. Verified `ci-static.sh` (panel, UI, version, release checks), all 13 conversion tests, module syntax compilation, and subscription integration tests.

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
