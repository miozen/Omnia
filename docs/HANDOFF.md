# Omnia Development Handoff

## Last Updated

2026-11-14T20:00+08:00

## Repository State

- **Current Branch:** `dev`
- **HEAD:** `9af8c0b` (feat: implement Milestone 4 local nodes and sandboxed script engine)
- **Working Tree:** CLEAN
- **Remote Sync:** Pushed to `origin/dev`

## Development State

- **Current Phase:** Post-v0.1.0 Feature Development — Native Subscription Conversion (Milestones 1-4 Complete)
- **Current Task:** LuCI UI integration for native conversion, local nodes, operators, and preview
- **Last Completed:**
  1. Implemented form-based local node parser (`convert/parsers/form.uc`) supporting ss, vmess, vless, trojan, hysteria2 (hy2), tuic, socks, http, detour rejection, and protocol normalization into IR nodes.
  2. Implemented sandboxed ucode script engine (`convert/operators/script.uc`) supporting batch and single modes, built-in utilities (`flags`, `is_ip`, `trim`, `starts_with`, `ends_with`, `match`, `replace`), context/params injection, and comprehensive error trapping (compilation, runtime, return type).
  3. Integrated script operator into ordered pipeline engine (`convert/operators/engine.uc`) and pipeline (`convert/pipeline.uc` -> `convert_form_nodes`).
  4. Added preview conversion function (`subscription_fetch.uc` -> `preview_subscription_nodes`).
  5. Updated subscription schema (`subscription_policy_schema.uc`), supporting `type: "local"`, optional URL, and payload / nodes persistence.
  6. Updated subscription refresh workflow (`subscription.uc`), bypassing HTTP fetch for local sources and converting local payload or form nodes with operators and DNS support.
  7. Created comprehensive test suite (`tests/convert-step-m4-local-and-script.uc`) and unified test runner update (13 tests passing, module syntax compilation passing).

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

- Real device or OpenWrt 25.12.x VM acceptance before final master merge.

## Known Issues / Blockers

None. M1, M2, M3, and M4 backend conversions and engines are fully verified.

## Exact Next Action

1. Proceed with LuCI UI integration for native conversion, local nodes, operators, and preview.

## Cross-machine Ready

**YES** — Committed and pushed to `origin/dev`. Working tree is CLEAN.
