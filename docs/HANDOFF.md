# Omnia Development Handoff

## Last Updated

2026-11-20T23:30+08:00

## Repository State

- **Current Branch:** `dev`
- **HEAD:** committed and pushed
- **Working Tree:** CLEAN
- **Remote Sync:** Branch `dev` synchronized with remote origin/dev

## Development State

- **Current Phase:** Post-v0.1.0 Stabilization — Real-Hardware Ergonomics & Conversion Enhancements
- **Current Task:** Fix subscription error auto-clear, local node stats & VLESS parsing, region delete button, matrix headers wrapping, and main selector contrast
- **Last Completed:**
  1. Auto-clear Subscription Error Messages (`subscriptions.js`):
     - Removed obsolete `item.error` fallback rendering from subscription matrix in `subscriptions.js`.
     - Errors are now tied solely to active refresh execution (`refreshResultForSource`), ensuring failed download logs naturally clear when refreshing or reloading the page.
  2. Local Node Counting & Disabled Status Preservation (`subscription.uc`):
     - Updated `compile_local_source` in `subscription.uc` to compute and return true `total_count` even when `source.enabled == false`.
     - Updated `preserve_unselected_source` in `subscription.uc` to retain previous node count instead of clearing to 0 when disabled.
  3. Robust VLESS & sing-box JSON Parsing (`form.uc`, `sniffer.uc`, `singbox.uc`):
     - Supported single sing-box outbound objects in `sniffer.uc` (`parsed.type` with `server` / `port` / `tag`) and `singbox.uc` (`raw_outbounds = [ parsed_json ]`).
     - Enhanced `form.uc` with full support for sing-box nested `tls: { enabled: true, server_name: "...", reality: { ... } }`, extracted `reality`, `sni`, `alpn`, `skip_cert_verify`, and transport layers (`ws`, `grpc`, `http`).
     - Enhanced `cipher` mapping fallback for `method` in `singbox.uc`.
  4. Regional Keyword Delete Button Alignment (`subscriptions.js`):
     - Moved the delete button in `policySettings` (`subscriptions.js`) to the end of the input field in `cbi-value-field`.
     - Standardized its style to `omniaMotion.buttonClass('btn cbi-button cbi-button-remove')` with `_('删除')` label matching the subscriptions table.
  5. Subscription Matrix Layout Optimization (`subscriptions.js`):
     - Added `white-space: nowrap; min-width: 3.5rem;` to `<th>` for `启用` and `节点` columns, completely preventing awkward Chinese character line breaks.
     - Separated custom DNS and operators into a dedicated second line below the URL to free up horizontal column space.
  6. High-Contrast Root Main Selector Card (`selectors.js`):
     - Replaced low-contrast `#f8fafc` text on slate background in `selectors.js` with `#eff6ff` light-blue card, `#1e3a8a` dark-blue title, `#1d4ed8` button, and `#475569` description, ensuring crystal-clear readability on light themes.
  7. Verification:
     - Validated syntax on all JavaScript files via `node --check`.
     - Verified all UI and behavior test suites (`panel-behavior.cjs`, `subscription-ui.cjs`, `selectors-ui.cjs`, `profile-ui.cjs`, `diagnostics-ui.cjs`, `overview-ui.cjs`).

## Validation Performed

- `node --check` across all JS files: PASS
- `node tests/panel-behavior.cjs; node tests/subscription-ui.cjs; node tests/selectors-ui.cjs; node tests/profile-ui.cjs; node tests/diagnostics-ui.cjs; node tests/overview-ui.cjs`: PASS

## Exact Next Action

Deploy on OpenWrt real hardware (`op.lan`), verify subscription refresh error clearing on F5, local node count visibility, VLESS nodes parsing, region delete button ergonomics, and selectors high-contrast card.

## Cross-machine Ready

**YES** — Working tree clean, all changes committed and pushed to `dev`.
