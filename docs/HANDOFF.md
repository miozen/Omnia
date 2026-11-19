# Omnia Development Handoff

## Last Updated

2026-11-19T10:10+08:00

## Repository State

- **Current Branch:** `dev`
- **HEAD:** (committed and pushed to dev)
- **Working Tree:** CLEAN
- **Remote Sync:** Branch `dev` synchronized with remote origin/dev

## Development State

- **Current Phase:** Post-v0.1.0 Stabilization — Code Hygiene & Refinement
- **Current Task:** Comprehensive Quality & Protocol Audit Fixes (10 Core Items)
- **Last Completed:**
  1. Protocol & IR Standardization (T-1, T-2):
     - Normalized Shadowsocks outbound type to official sing-box standard `shadowsocks` in `producer.uc`, `ir.uc`, `singbox.uc`, and `subscription_snapshot.uc`.
     - Parsed SIP002/SIP003 `plugin` and `plugin_opts` in `uri.uc` and mapped to `producer.uc` outbounds.
     - Updated test fixtures and assertions in `tests/convert-step2-uri.uc` and `tests/convert-step-m4-local-and-script.uc`.
  2. Data Integrity & Safety (T-3, T-4, T-5):
     - Implemented word-boundary isolated matching in `generator_util.uc` for ASCII country codes, preventing `AUSTRALIA`/`RUSSIA` -> `US` and `ESG` -> `SG` collisions.
     - Replaced manual `json_escape` with ucode standard `sprintf("%J")` unquoted string representation in `core/utils.uc`, safely handling ANSI escape codes and control characters `< 0x20`.
     - Upgraded `core/task_lock.uc` recovery state machine: 5-second recovery window when runner PID is dead (`!pid_alive`), retaining 30-second startup protection when preclaimed PID is empty.
  3. Performance & Polling Telemetry (T-6, T-7, T-8, T-9):
     - Added in-memory `stat(mtime)` metadata cache in `clash.uc`, eliminating duplicate `config.json` disk reads and JSON parsing on 3s live polling ticks.
     - Eliminated multi-process spawning in `scheduler_state.uc` via single time components extraction, and made route/rule cleanup diagnostics lazy when sing-box is already running in `runtime.uc`.
     - Guarded `runtime_status` in `runtime.uc` with a 3-second cache window to avoid rpcd event-loop saturation.
     - Fixed `overview.js:probeLatencyTarget` so `img.onerror` resolves `null`, accurately marking blocked targets as `超时/阻断` instead of 2~5ms.
     - Cleared hardcoded placeholder IP addresses from `netSiteDatabase` in `overview.js`.
  4. Theming & Code Hygiene (T-10, T-11):
     - Adapted `ui.js` and `overview.js` to LuCI standard CSS variables (`--card-background`, `--border-color`, `--text-color`, `--text-color-muted`, `--table-hover-color`) for Dark Mode compatibility.
     - Centralized canonical utility functions in `core/utils.uc` (`trim`, `trim_line`, `starts_with`, `ends_with`, `append_unique`) and eliminated local duplicates across `clash.uc` and `scheduler_state.uc`.

## Uncommitted Work

Modified files:
- `docs/CURRENT_PLAN.md`
- `docs/HANDOFF.md`
- `luci-app-omnia/htdocs/luci-static/resources/omnia/ui.js`
- `luci-app-omnia/htdocs/luci-static/resources/view/omnia/overview.js`
- `luci-app-omnia/root/usr/share/ucode/omnia/clash.uc`
- `luci-app-omnia/root/usr/share/ucode/omnia/convert/ir.uc`
- `luci-app-omnia/root/usr/share/ucode/omnia/convert/parsers/uri.uc`
- `luci-app-omnia/root/usr/share/ucode/omnia/convert/producer.uc`
- `luci-app-omnia/root/usr/share/ucode/omnia/core/scheduler_state.uc`
- `luci-app-omnia/root/usr/share/ucode/omnia/core/task_lock.uc`
- `luci-app-omnia/root/usr/share/ucode/omnia/core/utils.uc`
- `luci-app-omnia/root/usr/share/ucode/omnia/generator_util.uc`
- `luci-app-omnia/root/usr/share/ucode/omnia/runtime.uc`
- `luci-app-omnia/root/usr/share/ucode/omnia/subscription_snapshot.uc`
- `tests/convert-step-m4-local-and-script.uc`
- `tests/convert-step2-uri.uc`

## Validation Performed

- `bash tests/ci-static.sh`: PASS (All 7 UI, static, and workflow suites passed)
- `bash tests/run-all-convert-tests.sh`: PASS (All 13 pure-function and integration suites passed)
- `git.exe -c safe.directory=* diff --check`: PASS (0 whitespace / formatting errors)

## Exact Next Action

Ready for device acceptance testing on OpenWrt 25.12+ / real hardware before merging dev into master.

## Cross-machine Ready

**YES** — Working tree clean, all changes committed and pushed to `dev`.
