# Omnia Development Handoff

## Last Updated

2026-11-19T17:15+08:00

## Repository State

- **Current Branch:** `dev`
- **HEAD:** `021e890` (committed and pushed)
- **Working Tree:** CLEAN
- **Remote Sync:** Branch `dev` synchronized with remote origin/dev

## Development State

- **Current Phase:** Post-v0.1.0 Stabilization — Feature Refinement & Selector Allocation
- **Current Task:** Selector Outbounds Dynamic Allocation & Resource Tab Reorder
- **Last Completed:**
  1. Resource Management Tab Order Swap:
     - Reordered tabs in `resources.js` placing `[ 订阅 (Subscriptions) ]` before `[ 模板 (Template & Selectors) ]`.
     - Set default active tab to `'subscriptions'`.
  2. Selector Outbounds Dynamic Allocation Core Engine:
     - Added `PATH.SELECTORS` to `core/constants.uc` (`/etc/omnia/selectors.json`).
     - Implemented `profile_selectors.uc` with storage persistence, candidate pool resolution (`get_selector_candidate_pool`), member resolution (`resolve_selector_members`) with automatic fallback to `main`, and synchronization (`sync_template_selectors`).
     - Updated `generator_selectors.uc` (`inject_selectors`) supporting 4-tier source priority (Priority 1: Omnia user config; Priority 2: template `x_rule`; Priority 3: template native outbounds; Priority 4: automatic fallback to `main`).
     - Preserved system root `main` (`🗽 节点选择`, `x_rule: "main"`) as immutable global aggregator and fallback.
     - Updated `generator_manual_selector.uc` to isolate custom-configured selectors from automatic manual selector injection.
     - Wired selector configuration into `generator.uc` (`generate_candidate`).
     - Integrated `sync_template_selectors` into `profile.uc` on save, remote sync, restore default, and rollback.
  3. RPC & ACL Integration:
     - Exposed `template_selectors_get` and `template_selectors_save` in `omnia.uc`.
     - Added `template_selectors_get` to read ACL and `template_selectors_save` to write ACL in `luci-app-omnia.json`.
  4. LuCI Frontend Card Allocator in `profile.js`:
     - Rendered Selector Outbounds Allocation cards section above the raw JSON editor.
     - Provided member chips with removal `✕`, candidate quick-add buttons for 5 regions (`HK`, `TW`, `SG`, `JP`, `US`), `⚡ 全选地区` shortcut, and core system targets (`main`, `direct`, `manual`).
     - Implemented single-selector preview modal dialog triggered by magnifying glass (`🔍`) button next to each selector tag, featuring formatted sing-box outbound JSON and 1-click clipboard copy.
     - Added save and reset action buttons.
  5. Automated Testing:
     - Created `tests/profile-selectors.uc` testing member resolution, priority 1 override, fallback, manual selector isolation, and tag helpers.
     - Added test 14 to `tests/run-all-convert-tests.sh` (all 14 ucode test suites passing).
     - Updated `tests/profile-ui.cjs` asserting member addition, removal, quick all regions, save, reset, and modal preview (all 10 UI tests passing).
     - Verified static checks `tests/ci-static.sh` passing.

## Validation Performed

- `bash tests/ci-static.sh`: PASS (All UI, static, and workflow suites passed)
- `bash tests/run-all-convert-tests.sh`: PASS (All 14 pure-function, integration, and module compilation suites passed)
- `docker run ... control-encoding.uc && grpc-proto.uc`: PASS

## Exact Next Action

Ready for testing and device deployment on OpenWrt 25.12+ / real hardware before merging dev into master.

## Cross-machine Ready

**YES** — Working tree clean, all changes committed and pushed to `dev`.
