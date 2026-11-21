# Omnia Development Handoff

## Last Updated

2026-11-21T02:25+08:00

## Repository State

- **Current Branch:** `dev`
- **HEAD:** committed and pushed
- **Working Tree:** CLEAN
- **Remote Sync:** Branch `dev` synchronized with remote origin/dev

## Development State

- **Current Phase:** Post-v0.1.0 Stabilization — Real-Hardware Ergonomics & Conversion Enhancements
- **Current Task:** Sub-Store Protocol Alignment & Sing-box Schema Normalization
- **Last Completed:**
  1. Universal Sing-box Schema Sanitizer (`clean_singbox_outbound` in `producer.uc`):
     - Modeled directly on Sub-Store's schema cleaner to prevent fatal sing-box config decode crashes on candidate generation (`outbounds[x].obfs: unknown obfs type: none`).
     - Hysteria 2 obfuscation alignment: strictly retains `obfs` only when `type == "salamander"` and `password != ""`; strips `obfs: { type: "none" }`, string `"none"`, and empty passwords.
     - Non-Hysteria 2 obfuscation purge: deletes rogue `obfs` blocks on all non-Hysteria 2 protocols (Shadowsocks, VMess, VLESS, Trojan, TUIC, AnyTLS, SOCKS, HTTP).
     - Shadowsocks plugin normalization: strips invalid `plugin: "none"` or empty plugin configurations and associated `plugin_opts`.
     - VMess / VLESS alignment: cleans empty `packet_encoding` and invalid `flow`.
     - TLS & Reality cleanup: purges empty `reality` objects (when `public_key` is empty) and empty ALPN arrays.
     - Multiplex & Bandwidth cleanup: removes `multiplex: { enabled: false }`, zero mbps ratings, and residual Clash fields (`up`, `down`).
  2. Multi-source Defensive Schema Gating:
     - Outbound Producer (`producer.uc`): applies `clean_singbox_outbound` to both raw baseline templates (`_raw_outbound`) and newly synthesized IR nodes.
     - Raw Sing-box Extractor (`parsers/singbox.uc`): enhanced `sanitize_raw_outbound` to sanitize `obfs` and `plugin`.
     - Snapshot Security Gate (`subscription_snapshot.uc`): runs `clean_singbox_outbound` on every outbound in `sanitize_and_validate_outbounds` before persistence.
     - Form & Clash Parsers (`parsers/form.uc`, `parsers/clash.uc`): strict protocol field separation ensuring `obfs` is only assigned to Hysteria 2 and `plugin` to Shadowsocks.
     - Multi-protocol URI Parsers (`parsers/uri.uc`): supported standard name fallback (`#fragment` > `remarks` > `remark` > `title` > `host:port`) across VMess, Shadowsocks, Hysteria 2, TUIC, and SOCKS/HTTP, and stripped `plugin=none` / `obfs=none`.
  3. Comprehensive Test Suite & Verification:
     - Expanded `tests/convert-step4-producer.uc` with test cases for Hysteria 2 `obfs: none` purging, Shadowsocks `plugin: none` purging, rogue non-hysteria obfs purging, and Reality/multiplex cleanup.
     - All 15 convert and integration test suites passed in Docker OpenWrt rootfs (`tests/run-all-convert-tests.sh`).
     - Static checks and UI test suites passed 100% (`tests/ci-static.sh`).

## Validation Performed

- `bash tests/run-all-convert-tests.sh` (inside Docker rootfs): PASS (All 15 suites & module compilations passed)
- `bash tests/ci-static.sh`: PASS (All UI suites, schema validation, and workflow checks passed)
- `node tests/subscription-ui.cjs; node tests/selectors-ui.cjs; node tests/profile-ui.cjs; node tests/overview-ui.cjs`: PASS

## Exact Next Action

Deploy on OpenWrt real hardware (`op.lan`), refresh local subscriptions, and verify that automated ruleset updates succeed without candidate config decode errors.

## Cross-machine Ready

**YES** — Working tree clean, all changes committed and pushed to `dev`.
