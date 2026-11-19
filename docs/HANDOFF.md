# Omnia Development Handoff

## Last Updated

2026-11-19T15:18+08:00

## Repository State

- **Current Branch:** `dev`
- **HEAD:** `a1616e0` (committed and pushed)
- **Working Tree:** CLEAN
- **Remote Sync:** Branch `dev` synchronized with remote origin/dev

## Development State

- **Current Phase:** Post-v0.1.0 Stabilization — Feature Refinement & Bug Fixes
- **Current Task:** Local Node Save Bug Fix & Sub-Store-style Sing-box Node Preview
- **Last Completed:**
  1. Local Node Save & Status Bug Fix:
     - Fixed `ui.js` `checkboxInput` missing DOM boolean property assignment (`input.checked = isChecked; input.defaultChecked = isChecked;`), which previously caused `omnia-editor-enabled` to always evaluate as `false`.
     - Hardened `saveSourceEditor` in `subscriptions.js` to robustly evaluate `isEnabled` with property and attribute fallback.
     - Enhanced `subscriptions_save` in `subscription.uc` with `compile_local_source`, automatically compiling local sources into `/etc/omnia/node-snapshot.json` on save.
     - Updated `reloadPolicyFromBackend` in `subscriptions.js` to refresh snapshot summary alongside subscriptions config, updating matrix node counts and status immediately without manual page reload.
  2. Sub-Store-style Sing-box Node Preview:
     - Implemented `subscription_source_preview(trace_id, req)` in `subscription.uc`, supporting both saved sources (by `source_id`) and drafted source objects (by `source`), returning standardized sing-box `outbounds` and `protocol_counts`.
     - Registered and exposed `subscription_source_preview` via rpcd (`omnia.uc`) and ACL (`luci-app-omnia.json`).
     - Implemented rich `openNodePreviewModal` in `subscriptions.js`:
       - Interactive protocol pill badges (Shadowsocks, VLESS, VMess, Trojan, Hysteria2, TUIC, WireGuard, Direct) with instant filter on click.
       - Real-time client-side search filtering across node tags, server addresses, ports, and protocols.
       - Dual-view switcher: List Card View (showing protocol badge, server:port, TLS/Reality tags, Transport tags, and expandable individual outbound JSON) and Raw JSON View (showing full sing-box formatted outbounds with 1-click clipboard copy).
       - Keyboard `Esc` and backdrop click dismissal.
     - Integrated preview into:
       - Each subscription source row in `sourceMatrix` ("预览" button).
       - Source editor modal bottom actions ("👁️ 节点预览" button).
       - Top subscription page actions ("👁️ 预览快照节点" button for the global snapshot).
  3. Automated Testing:
     - Added test 5 to `tests/subscription-ui.cjs` asserting local source atomic save with `enabled: true`.

## Validation Performed

- `bash tests/ci-static.sh`: PASS (All UI, static, and workflow suites passed)
- `bash tests/run-all-convert-tests.sh`: PASS (All 13 pure-function and integration suites passed)

## Exact Next Action

Ready for device acceptance testing on OpenWrt 25.12+ / real hardware before merging dev into master.

## Cross-machine Ready

**YES** — Working tree clean, all changes committed and pushed to `dev`.