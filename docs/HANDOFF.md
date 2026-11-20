# Omnia Development Handoff

## Last Updated

2026-11-20T15:25+08:00

## Repository State

- **Current Branch:** `dev`
- **HEAD:** `0dd790e` (committed and pushed)
- **Working Tree:** CLEAN
- **Remote Sync:** Branch `dev` synchronized with remote origin/dev

## Development State

- **Current Phase:** Post-v0.1.0 Stabilization — Dynamic Custom Region Groups & Expanded Flags
- **Current Task:** Custom Regions Implementation & Flags Expansion
- **Last Completed:**
  1. National Flags & ISO Algorithmic Fallback Engine (`flags.uc`):
     - Expanded `COUNTRY_FLAGS` dictionary from 20 to 70+ countries (including Nigeria `NG`, Ukraine `UA`, Egypt `EG`, Pakistan `PK`, Turkey `TR`, Argentina `AR`, and all common streaming/niche regions).
     - Implemented `iso_to_flag_emoji` based on UTF-8 Regional Indicator symbols (`0x1F1E6 ~ 0x1F1FF`) for 100% universal 2-letter ISO flag generation.
     - Implemented and exported `get_country_info(code)` and `iso_to_flag_emoji(code)`.
  2. Backend Schema Normalization & Defensive Cleanup (`subscription_policy_schema.uc`):
     - Updated `normalize_region_keywords`: preset 5 regions only populate as initial defaults if `raw` is missing/null; strictly respects user's custom dictionary without re-injecting deleted presets.
     - Updated `normalize_allowed_regions` and `normalize_rate_filter`: quietly filters out deleted regions without throwing exceptions (`die`).
  3. Generator & Selector Pool Integration (`generator_groups.uc`, `profile_selectors.uc`):
     - Enhanced `region_order` in `generator_groups.uc` to recognize `config.region_keywords` keys.
     - Formatted speedtest group tags and selector candidate pools dynamically with country flags and Chinese names.
     - Exported `region_flag_str` and `region_name_str`.
  4. LuCI Frontend Dynamic Custom Regions (`subscriptions.js`):
     - Added `KNOWN_COUNTRIES`, `isoToFlagEmoji`, and `getCountryMetadata` dictionary and helpers.
     - Updated `regionKeys(policy)` to dynamically read `Object.keys(policy.region_keywords || {})`.
     - Rendered flag and delete `✕` button for every region row (including the 5 presets) with confirmation dialog.
     - Added `[ ➕ 添加自定义区域 ]` modal with instant ISO code lookup, country name/flag badge display, and keyword prefilling.
     - Added `[ ↺ 恢复出厂五区 ]` button with reset confirmation dialog.
     - Implemented automatic cascading cleanup when deleting a region (`s.allowed_regions` and `rate_filter.matched_regions`).
     - Displayed country flags in matrix table headers, rate filter checkboxes, and source editor checkboxes.
  5. Selector Preview Adaptation (`profile.js`):
     - Dynamically formatted preview outbound labels `${candidateLabel(m)} 测速组`.
  6. Automated Test Coverage:
     - Updated `tests/subscription-ui.cjs` asserting flag conversions, metadata lookup, normalization, deletion, cascading cleanup, custom addition, and default reset.
     - Updated `tests/profile-selectors.uc` asserting expanded country flags and dynamic candidate pool resolution.
     - Verified static checks `tests/ci-static.sh` passing.
     - Verified test runner `tests/run-all-convert-tests.sh` passing (14 suites + module compilation).

## Validation Performed

- `bash tests/ci-static.sh`: PASS (All UI, static, and workflow suites passed)
- `bash tests/run-all-convert-tests.sh`: PASS (All 14 pure-function, integration, and module compilation suites passed)

## Exact Next Action

Ready for testing and device deployment on OpenWrt 25.12+ / real hardware before merging dev into master.

## Cross-machine Ready

**YES** — Working tree clean, all changes committed and pushed to `dev`.
