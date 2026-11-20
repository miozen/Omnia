# Omnia Development Handoff

## Last Updated

2026-11-21T00:35+08:00

## Repository State

- **Current Branch:** `dev`
- **HEAD:** committed and pushed
- **Working Tree:** CLEAN
- **Remote Sync:** Branch `dev` synchronized with remote origin/dev

## Development State

- **Current Phase:** Post-v0.1.0 Stabilization — Real-Hardware Ergonomics & Conversion Enhancements
- **Current Task:** Sub-Store-compatible VLESS URI parser & region group name left alignment
- **Last Completed:**
  1. Sub-Store-Compatible VLESS URI Parser (`uri.uc`):
     - Implemented Sub-Store `proxy-utils` authority handling: automatically detects and safely base64-decodes authorities (`auto:UUID@host:port`), stripping `auto:` / `none:` encryption prefixes to ensure valid UUIDs.
     - Extracted node names with fallback priority: `fragment` > `remarks` > `remark` > `title` > `host:port`.
     - Multi-faceted Reality & TLS detection: recognises `pbk` (Reality public key), `xtls=2`, or `security=reality`, and extracts SNI from `sni` or `peer`.
     - Transport normalization: maps `type`, `net`, `network`, `obfs`, `transport` to standard types, extracting gRPC `service_name` from `serviceName` or `path` (`obfs=grpc&path=grpc`).
  2. Region Group Name Left-Alignment (`subscriptions.js`):
     - Added `text-align: left;` to `label.cbi-value-title` in `policySettings` to ensure national flag emojis and region names line up neatly on the left margin.
  3. Comprehensive Verification & Unit Tests:
     - Added unit tests for both user VLESS links (Reality TCP & Reality gRPC) to `tests/convert-step2-uri.uc`.
     - All 15 convert and integration test suites passed in Docker OpenWrt rootfs (`tests/run-all-convert-tests.sh`).
     - Static checks and UI test suites passed 100% (`tests/ci-static.sh`).

## Validation Performed

- `bash tests/run-all-convert-tests.sh` (inside Docker rootfs): PASS (All 15 suites & module compilations passed)
- `bash tests/ci-static.sh`: PASS (All UI suites, schema validation, and workflow checks passed)
- `node tests/subscription-ui.cjs; node tests/selectors-ui.cjs; node tests/profile-ui.cjs; node tests/overview-ui.cjs`: PASS

## Exact Next Action

Deploy on OpenWrt real hardware (`op.lan`), verify local VLESS Reality nodes parsing, and check region group names left-aligned layout.

## Cross-machine Ready

**YES** — Working tree clean, all changes committed and pushed to `dev`.
