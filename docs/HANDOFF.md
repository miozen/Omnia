# Omnia Development Handoff

## Last Updated

2026-11-14T18:30+08:00

## Repository State

- **Current Branch:** `dev`
- **HEAD:** `e6cfc0a` (feat: implement Milestone 3 declarative dedicated DNS scheme)
- **Working Tree:** CLEAN
- **Remote Sync:** Pushed to `origin/dev`

## Development State

- **Current Phase:** Post-v0.1.0 Feature Development — Native Subscription Conversion (Milestone 3 Complete)
- **Current Task:** Implement Milestone 4 (Local nodes paste/form import & sandboxed ucode scripts)
- **Last Completed:**
  1. Declarative subscription source DNS schema and validation (`subscription_policy_schema.uc`), supporting `address`, `detour` (direct-only strict validation), and optional `address_resolver` / `strategy`.
  2. Profile generator dedicated DNS injection and tag assignment (`generator_dns.uc` -> `apply_source_dedicated_dns`), allocating `dns-src-<id>` tag and assigning `node.domain_resolver` for matching source nodes.
  3. Default inheritance: nodes from sources without dedicated DNS omit `domain_resolver`, seamlessly defaulting to `route.default_domain_resolver`.
  4. Deadlock prevention: explicit prohibition of proxy/selector detour on source dedicated DNS servers.
  5. Anti-dangling reference validator (`generator_validate.uc` -> `validate_references`), verifying `outbound.domain_resolver` and `server.domain_resolver` against `profile.dns.servers` tags.
  6. Comprehensive test suite `tests/generator-dedicated-dns.uc` and unified runner `tests/run-all-convert-tests.sh` with 12 tests passing.

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
  - UCode syntax compilation on all modules (`ucode -c,module`) PASS
- Subscription refresh integration test (`tests/run-subscription-integration.sh`) PASS.
- Full CI static suite (`tests/ci-static.sh`) PASS via Node.js v22.
- `git diff --check` passed with 0 errors.

## Validation Pending

- Real device or OpenWrt 25.12.x VM acceptance before final master merge.

## Known Issues / Blockers

None. M1, M2, and M3 are fully verified.

## Exact Next Action

1. Plan and implement Milestone 4 (M4): Local nodes (paste/form) & sandboxed ucode scripts.

## Cross-machine Ready

**YES** — Committed and pushed to `origin/dev`. Working tree is CLEAN.
