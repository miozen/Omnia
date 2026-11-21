# Omnia Development Handoff

## Last Updated

2026-11-21T15:40+08:00

## Repository State

- **Current Branch:** `dev`
- **HEAD:** f131534 feat(convert,ui,docs): resolve reliability audit findings, expand protocol parameters, and harden supply chain
- **Working Tree:** CLEAN
- **Remote Sync:** Branch `dev` tracked against origin/dev

## Development State

- **Current Phase:** Post-v0.1.0 Stabilization — Architecture Audit & Reliability Slices Complete
- **Current Task:** All Slices (Slice 1, Slice 2, Direction B, Slice 3) Complete & Pushed to dev
- **Last Completed:**
  1. Slice 1: Core Interaction Defects & DOM Synchronization
     - Custom Region DOM & State Linkage (`subscriptions.js`): Fixed issue where added custom regions (e.g. `KR`) were missing from Region Keywords and Rate Filter matched regions.
     - Selector Apply Healthcheck Consistency (`selectors.js`): Added `applyData.health_ready === false` check in `saveAndApplySelectors`.
     - Zero-Latency Baseline Fidelity (`overview.js`): Reset initial latency history to clean empty arrays.
  2. Slice 2: Observability & Polling Safety
     - Bounded Polling Loop Limits (P1-5): Added `MAX_POLL_ATTEMPTS = 120` to `rulesets.js` (`pollRulesetSync`, `pollRulesetDownloadOne`) and `subscriptions.js` (`waitRefresh`). Stalled or crashed background tasks cleanly time out after 120 attempts instead of polling indefinitely.
     - Dropped Fields Telemetry (P1-3): Implemented `dropped_fields` tracking in `producer.uc` (`clean_singbox_outbound`), `pipeline.uc`, `generator_nodes.uc`, and `generator.uc`. Outbounds carry temporary `x_omnia_dropped_fields` metadata (stripped before sing-box candidate generation), and `config_generate` returns aggregated dropped field statistics.
     - Universal Outbound Sanitizer Comments & Invariant Intent (P1-7, P2-9): Updated `clean_singbox_outbound` header comment in `producer.uc` and documented exact kernel constraints for every field removal (obfs, SS plugin, packet_encoding, flow, reality, transport, multiplex, bandwidth, and environment bindings).
     - Overview UI Observability Banner (`overview.js`): Added informative tip to the one-click apply success notification when dropped/normalized parameters are present (e.g. `obfs: 2, plugin: 1`).
  3. Direction B: Protocol Expansion & Schema Enrichment (P0-1 & P0-2)
     - Hysteria 2 gecko Obfuscation (P0-1):
       - IR schema (`convert/ir.uc`): Added `obfs_min_packet_size` and `obfs_max_packet_size` properties, and marked TLS as inherent for hysteria2, tuic, and anytls.
       - Outbound producer (`convert/producer.uc`): Supported `gecko` obfs type with `min_packet_size` and `max_packet_size` in `produce_hysteria2`; updated `clean_singbox_outbound` whitelist to preserve gecko alongside salamander with packet size constraints.
       - Parsers: Added gecko obfs and min/max packet size parsing in URI parser (`convert/parsers/uri.uc`), Clash parser (`convert/parsers/clash.uc`), and Form parser (`convert/parsers/form.uc`).
     - Airport Node Advanced Parameters (P0-2):
       - Shadowsocks: In `convert/parsers/uri.uc`, synthesized `plugin_opts` for `v2ray-plugin` from query parameters (`tls`, `host`, `path`, `mode`) if not already formatted as semicolon options.
       - VMess / VLESS: Extracted `packet_encoding` (`packetaddr`, `xudp`), `alpn`, and `fingerprint` (uTLS) from URI query and v2rayN JSON Base64.
       - VLESS / Trojan `xhttp` / `httpupgrade`: Extracted transport `path` and `host`, normalized `xhttp` to sing-box `httpupgrade`, produced `transport: { type: 'httpupgrade', path: ..., host: ... }`, and preserved `httpupgrade` in `clean_singbox_outbound`.
       - uTLS Client Fingerprint: Added `tls.utls: { enabled: true, fingerprint: ... }` generation in `produce_tls` and preserved `tls.utls` in `clean_singbox_outbound`.
  4. Slice 3: Documentation & Engineering Hygiene (P1-8, P2-10, P2-11, P2-12)
     - Documentation Alignment (P1-8):
       - `docs/ARCHITECTURE.md`: Added `selectors.js` to Views list (completing 10 LuCI views); updated testing architecture to accurately describe container-based ucode/parser unit & integration tests vs real-device kernel TUN/procd acceptance.
       - `docs/DEVELOPMENT.md`: Clarified full multi-tier testing scope (static/syntax validation, Node.js virtual DOM UI behavior tests, Docker OpenWrt pure-function & converter integration suites, release workflow tests, and device acceptance).
     - Release Supply Chain Hardening (P2-10):
       - `scripts/build.sh`: Added explicit warning when building unsigned APK (`WARNING: APK_SIGNING_KEY is not set... requires --allow-untrusted`), and enforced strict abort when `STRICT_SIGNING=1` or `REQUIRE_APK_SIGNING=1`.
       - `.github/workflows/build-ipk.yml` & `release.yml`: Pinned `ipkg-build` to immutable release tag `v23.05.5` with SHA256 checksum verification (`aaec7d5798f7463d...`), eliminating unverified `master` raw script downloads.
     - Code Hygiene & Dead Code Purge (P2-12):
       - Deduplicated `formatDiagnosticError`: Extracted shared diagnostic alert helper into `resources/omnia/ui.js` (`omniaUi.formatDiagnosticError`), and updated `overview.js` and `profile.js` to delegate to it.
       - Dead Code Removal: Purged unused RPC declaration `callNodeDelayTest` in `overview.js`.
  5. Unit Test Suites Updated:
     - `tests/convert-step2-uri.uc`: Added tests for SS v2ray-plugin options synthesis, VMess packetEncoding/fingerprint, VLESS xhttp/httpupgrade/packetEncoding/fingerprint, and Hysteria 2 gecko obfs packet sizes.
     - `tests/convert-step4-producer.uc`: Added tests for Hysteria 2 gecko outbound synthesis, VLESS xhttp/packet_encoding/uTLS synthesis, raw outbound fidelity preservation for httpupgrade and utls, and `dropped_stats` / `x_omnia_dropped_fields` recording.
     - `tests/subscription-ui.cjs`: Added test step 7f verifying `waitRefresh` clean termination on `MAX_REFRESH_POLL_ATTEMPTS`.
     - `tests/overview-ui.cjs`: Added Test 1b verifying dropped fields summary banner rendering, and updated mock `omniaUi.formatDiagnosticError`.
     - `tests/profile-ui.cjs`: Added mock `omniaUi.formatDiagnosticError`.

## Validation Performed

- `bash tests/run-all-convert-tests.sh` (Docker OpenWrt rootfs): PASS (15 suites & module syntax checks passed 100%)
- `find luci-app-omnia/htdocs -type f -name "*.js" -exec node --check {} +`: PASS (Syntax check passed)
- `node tests/subscription-ui.cjs`: PASS
- `node tests/selectors-ui.cjs`: PASS
- `node tests/overview-ui.cjs`: PASS
- `node tests/profile-ui.cjs`: PASS
- `node tests/diagnostics-ui.cjs`: PASS
- `node tests/panel-behavior.cjs`: PASS
- `docker run ... tests/control-encoding.uc`: PASS
- `docker run ... tests/grpc-proto.uc`: PASS
- `python3 tests/validate-profile-schema.py`: PASS
- `bash tests/release-version.sh`: PASS
- `python3 tests/release-workflow.py`: PASS
- `git diff --check`: PASS (Clean whitespace)

## Exact Next Action

Awaiting user guidance for next milestone or real hardware testing.

## Cross-machine Ready

**YES** — All changes committed and pushed to origin/dev. Working tree is clean.
