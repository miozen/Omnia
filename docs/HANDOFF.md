# Omnia Development Handoff

## Last Updated

2026-11-20T21:40+08:00

## Repository State

- **Current Branch:** `dev`
- **HEAD:** committed and pushed
- **Working Tree:** CLEAN
- **Remote Sync:** Branch `dev` synchronized with remote origin/dev

## Development State

- **Current Phase:** Post-v0.1.0 Stabilization — Template Validation Relaxation & Selector Policy Decoupling
- **Current Task:** Adapt profile validation, implement user-selectable main pool, split selectors into dedicated tab, and optimize profile editor layout
- **Last Completed:**
  1. Profile Validation Relaxation & Multi-tier Root Main Pool Resolution (`profile.uc`, `generator_validate.uc`):
     - Relaxed strict `x_rule: "main"` validation: profiles now require `selector_count >= 1` (asserting `main_selector_count <= 1`), allowing clean sing-box configurations without custom extensions.
     - Implemented 4-tier resolution priority for system root main selector: configured `main_selector` > `x_rule: "main"` > common tags ("🗽 节点选择", "节点选择", "Proxy", "auto") > first selector outbound.
  2. Persistent User-Selectable Root Main Selector (`profile_selectors.uc`, `generator_selectors.uc`, `generator.uc`):
     - Added `read_main_selector_config(template_key)` and updated `save_selectors_config(template_key, selectors_dict, main_selector_tag)` to store `main_selector` in `/etc/omnia/selectors.json`.
     - In `get_selector_candidate_pool`: included `all_selectors: [ { tag, is_main } ]` and `main_selector: main_tag`, and rendered the root main pool with preview outbounds aggregating all region groups and unmatched nodes.
     - Updated `generator_selectors.uc` (`inject_selectors`, `main_selector_option_count`) and `generator.uc` (`route_dns_detours`) to consistently receive and apply the resolved `main_tag`.
  3. Decoupled Dedicated Selector Policy Tab (`selectors.js`, `resources.js`):
     - Created `view/omnia/selectors.js` registered as `[ 分流 (selectors) ]` in `resources.js` tab navigation.
     - Features interactive root main pool dropdown selector, prominent `👑 系统根主池` status card with 🔍 preview, and individual business selector cards with member chips, region quick-add buttons, and `⚡ 保存并立即应用` CTA.
  4. Template Editor Layout Optimization (`profile.js`):
     - Moved "在线模板与拉取设置" (Remote Source Accordion) above the JSON profile editor, resolving the issue where settings were hidden beneath 400+ lines of editor content.
     - Cleaned up selector-related RPCs and functions from `profile.js`, keeping the template configuration page focused, fast, and ergonomic.
  5. Comprehensive Verification & Regression Tests:
     - Created `tests/selectors-ui.cjs` testing selector UI rendering, main pool change, member add/remove, reset, save, and apply.
     - Updated `tests/profile-ui.cjs`, `tests/profile-selectors.uc`, `tests/ci-static.sh`, and `tests/run-all-convert-tests.sh`.
     - All 14 convert test suites, ucode compilation, and static checks passed 100%.

## Validation Performed

- `bash tests/ci-static.sh`: PASS (All UI, static, and workflow suites passed)
- `bash tests/run-all-convert-tests.sh`: PASS (All 14 pure-function, integration, and module compilation suites passed)
- `node tests/profile-ui.cjs; node tests/selectors-ui.cjs; node tests/subscription-ui.cjs; node tests/overview-ui.cjs`: PASS

## Exact Next Action

Deploy on OpenWrt 25.12+ real hardware, verify template import without x_rule: main, root main selector switching, and selector policy allocation on dedicated tab.

## Cross-machine Ready

**YES** — Working tree clean, all changes committed and pushed to `dev`.
