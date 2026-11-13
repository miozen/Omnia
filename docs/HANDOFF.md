# Omnia Development Handoff

## Last Updated

2026-11-13T11:15+08:00

## Repository State

- **Current Branch:** `dev`
- **HEAD:** `8b4c214` — docs: establish development baseline and deduplicate runtime wait helpers
- **Working Tree:** DIRTY (M1 implementation completed, uncommitted)
- **Remote Sync:** Ahead/pending commit of M1 work

## Development State

- **Current Phase:** Post-v0.1.0 Feature Development — Native Subscription Conversion (M1)
- **Current Task:** Implement Milestone 1 (M1) Core conversion pipeline & compatibility hook
- **Last Completed:** Completed Step 1 through Step 7; full unit & integration tests passing in OpenWrt container.

## Uncommitted Work

Modified files:
- `luci-app-omnia/root/usr/share/ucode/omnia/subscription_snapshot.uc` — Allow source `sub-store` or `omnia`
- `luci-app-omnia/root/usr/share/ucode/omnia/generator_input.uc` — Allow source `sub-store` or `omnia`
- `luci-app-omnia/root/usr/share/ucode/omnia/subscription_fetch.uc` — Export `convert_to_outbounds`
- `luci-app-omnia/root/usr/share/ucode/omnia/subscription.uc` — Route refresh through `convert_to_outbounds` with fallback to `substore_outbounds`
- `docs/CURRENT_PLAN.md` — Updated progress for M1
- `docs/HANDOFF.md` — Updated handoff state

New files in `luci-app-omnia/root/usr/share/ucode/omnia/convert/`:
- `utils.uc` — Base64, URL decoding, querystring parser
- `ir.uc` — Unified IR node schema & validator
- `sniffer.uc` — Content format sniffer
- `producer.uc` — sing-box outbound producer with raw baseline fidelity
- `pipeline.uc` — Master pipeline & tag deduplication
- `parsers/uri.uc` — Multi-protocol URI parser (ss, vmess, vless, trojan, hy2, tuic, anytls, socks, http)
- `parsers/singbox.uc` — Native sing-box extractor with detour rejection & field sanitization

New tests:
- `tests/convert-step1.uc`
- `tests/convert-step2-uri.uc`
- `tests/convert-step3-singbox.uc`
- `tests/convert-step4-producer.uc`
- `tests/convert-step5-pipeline.uc`
- `tests/convert-step6-7-integration.uc`

## Validation Performed

- OpenWrt rootfs container tests: all 6 convert test suites passing 100%.
- Full CI static suite (`tests/ci-static.sh`) passing via Node.js v22.
- `git diff --check` passed with 0 errors.

## Validation Pending

- Real device verification when testing with actual remote subscriptions.

## Known Issues / Blockers

None.

## Exact Next Action

Await user review of Milestone 1 implementation. Once approved, commit and push to `origin/dev`.

## Cross-machine Ready

**NO** — Uncommitted changes in working tree.
