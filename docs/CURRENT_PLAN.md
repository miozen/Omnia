# Omnia Current Development Plan

## Current Phase

**Post-v0.1.0 Stabilization — Code Hygiene & Refinement**

## Goal

Maintain system stability on `dev` branch, eliminate known technical debt (code duplication between `apply.uc` and `runtime.uc`), and establish development norms.

## Completed

- [x] Project renamed to Omnia, all runtime identifiers unified.
- [x] First release `v0.1.0` published (2026-11-08).
- [x] Automated release pipeline (`release.yml`) operational.
- [x] CI verification pipeline (`build-ipk.yml`) operational.
- [x] Project audit completed — architecture, code quality, risks identified.
- [x] Core documentation structure established (AGENTS.md, ARCHITECTURE.md, DECISIONS.md, CURRENT_PLAN.md, HANDOFF.md).
- [x] Switched branch to `dev` and eliminated code duplication between `apply.uc` and `runtime.uc`.
- [x] Completed Milestone 1 (M1) of Native Subscription Conversion & Processing:
  - [x] Step 1: Base utilities (`convert/utils.uc`), IR schema (`convert/ir.uc`), and sniffer (`convert/sniffer.uc`).
  - [x] Step 2: Multi-protocol URI parser (`convert/parsers/uri.uc`: ss, vmess, vless, trojan, hy2, tuic, socks, http, anytls).
  - [x] Step 3: Native sing-box JSON extractor (`convert/parsers/singbox.uc`: detour rejection, environment sanitization, raw field fidelity).
  - [x] Step 4: sing-box outbound producer (`convert/producer.uc`: raw outbound baseline preservation & mapping).
  - [x] Step 5: Conversion master pipeline (`convert/pipeline.uc`: dirty node filtering & tag deduplication).
  - [x] Step 6: Snapshot backward/forward compatibility (`source: "sub-store"` and `source: "omnia"`).
  - [x] Step 7: Seamless hook into `subscription.uc` refresh pipeline with automatic fallback and preservation.
- [x] Completed M1 final audit and integration verification:
  - [x] Resolved mock server dependency for `tests/subscription-refresh-integration.uc`, verified passing.
  - [x] Added `tests/run-subscription-integration.sh` wrapper for automated testing with fixture server.
  - [x] Clarified test categorization hierarchy: container pure-function, container HTTP integration, QEMU VM, real hardware.
- [x] Fixed M1 fallback bypass vulnerability and established unified security sanitization:
  - [x] Implemented `is_legacy_compatible_input` and `parse_subscription_safely` in `subscription_fetch.uc` (fail-closed on unknown/corrupted formats).
  - [x] Implemented `sanitize_and_validate_outbounds` in `subscription_snapshot.uc` (unified security gate, node-level rejection of non-empty detour, protocol filtering, environment and DNS field stripping, port normalization, tag deduplication).
  - [x] Preserved existing snapshot upon zero valid nodes or unrecoverable parse failures in `subscription.uc`.
  - [x] Added regression and security test suite `tests/subscription-fallback-security.uc`.
  - [x] Verified M1 convert steps 1~7, fallback security test, subscription integration test, ucode module compilation, and `ci-static.sh` all passing.
- [x] Completed Milestone 2 (M2) of Native Subscription Conversion & Processing:
  - [x] Step 1: Restricted Clash YAML parser (`convert/parsers/clash.uc` supporting Block and Flow style mapping, comment stripping, Reality/WS/gRPC sub-options, detour rejection, protocol normalization).
  - [x] Step 2: Ordered operators pipeline (`convert/operators/engine.uc` supporting regex filter/inverse, type filter, conditional filter with AND/OR logic, regex rename/delete, quick setting, handle duplicate delete/rename, alphabetical & keyword priority sorting).
  - [x] Step 3: Flag emoji recognition and manipulation (`convert/operators/flags.uc` with common regional codes and emojis).
  - [x] Step 4: Subscription traffic quota & expiration header parsing (`convert/traffic.uc`).
  - [x] Step 5: Master pipeline integration in `convert/pipeline.uc`, `subscription_fetch.uc`, and `subscription.uc`.
  - [x] Step 6: Test suite covering Clash parser (`tests/convert-step-m2-clash.uc`), Operators (`tests/convert-step-m2-operators.uc`), Traffic headers (`tests/convert-step-m2-traffic.uc`), Cross-format consistency (`tests/convert-step-m2-integration.uc`), and unified runner (`tests/run-all-convert-tests.sh`).
- [x] Completed Milestone 3 (M3) of Native Subscription Conversion & Processing:
  - [x] Step 1: Declarative subscription source DNS schema (`subscription_policy_schema.uc`), supporting address, detour (direct-only enforcement), and optional address_resolver / strategy.
  - [x] Step 2: Source dedicated DNS tag allocation and sing-box profile injection (`generator_dns.uc` -> `apply_source_dedicated_dns`), binding matching subscription node outbound `domain_resolver` to dedicated tag `dns-src-<id>`.
  - [x] Step 3: Global fallback behavior: unconfigured subscription nodes retain no `domain_resolver`, falling back to `route.default_domain_resolver`.
  - [x] Step 4: Deadlock prevention: rejecting proxy/selector detour on source dedicated DNS servers to prevent bootstrapping circular dependencies.
  - [x] Step 5: Reference validation & anti-dangling check (`generator_validate.uc` -> `validate_references`), verifying outbound `domain_resolver` and server `domain_resolver` against `profile.dns.servers` tags.
  - [x] Step 6: Dedicated test suite `tests/generator-dedicated-dns.uc` and unified runner update (12 tests passing).
- [x] Completed Milestone 4 (M4) of Native Subscription Conversion & Processing:
  - [x] Step 1: Form-based local node parser (`convert/parsers/form.uc`) supporting ss, vmess, vless, trojan, hysteria2 (hy2), tuic, socks (socks5), http, detour rejection, and protocol normalization into IR nodes.
  - [x] Step 2: Sandboxed ucode script engine (`convert/operators/script.uc`) supporting batch mode and single node mode, built-in utilities (`flags`, `is_ip`, `trim`, `starts_with`, `ends_with`, `match`, `replace`), context/params injection, and comprehensive error trapping (compilation, runtime, return type).
  - [x] Step 3: Ordered operator pipeline integration (`convert/operators/engine.uc`) adding `script` / `script_operator` / `script_filter` operator support.
  - [x] Step 4: Pipeline integration (`convert/pipeline.uc` -> `convert_form_nodes`) and preview capability (`subscription_fetch.uc` -> `preview_subscription_nodes`).
  - [x] Step 5: Subscription schema update (`subscription_policy_schema.uc`), supporting `type: "local"`, optional URL, and payload / nodes persistence.
  - [x] Step 6: Local source refresh workflow (`subscription.uc`), bypassing HTTP fetch and safely converting local payload or form nodes with operators and DNS support.
  - [x] Step 7: Comprehensive test suite (`tests/convert-step-m4-local-and-script.uc`) and unified test runner update (13 tests passing, module syntax compilation passing).
- [x] Completed Milestone 5 (M5) of Native Subscription Conversion & Processing (LuCI UI & Frontend Integration):
- [x] Completed Post-v0.1.0 Diagnostics & Editor Enhancements:
  - [x] Tab order prioritization with Running Config JSON Viewer in Diagnostics (`diagnostics.js`).
  - [x] Line numbers gutter with synchronized scrolling and auto-updates in Diagnostics viewer and Profile editor (`profile.js`).
  - [x] Schema auto-validation and `ensureSchema` auto-injection without hard requirement (`profile.js`).
- [x] System Audit Slice 1 (Underlying Communication & Status Fidelity):
  - [x] Added `-S` (`--server-response`) to `wget_argv` in `core/netexec.uc` so HTTP response headers flow into stderr for subscription userinfo extraction.
  - [x] Enhanced `api_status.uc` to probe sing-box API via `NATIVE_API_SCRIPT` (`/usr/libexec/omnia-native-api`) when secret is configured, avoiding erroneous "未确认" (gray) status.
  - [x] Implemented traffic quota (GB/MB) and expiration date badges in `subscriptions.js` source tables and snapshot summary.
  - [x] Added unit tests in `tests/subscription-ui.cjs` and validated all 13 suites + static checks.
- [x] System Audit Slice 2 (Subscription Source Atomic Persistence):
  - [x] Changed editor modal button from "保存草稿" to "保存订阅源", performing in-place atomic persistence via `callSubscriptionsSave`.
  - [x] Added strict input validation for source name, URL protocol (must start with http:// or https:// for remote), and local payload/nodes.
  - [x] Replaced manual second-click "保存订阅设置" with automatic reload from backend on modal save, eliminating lost subscription drafts.
  - [x] Added user confirmation dialog and atomic persistence on deleting subscription sources (`removeSource`).
  - [x] Added unit tests for atomic save and atomic delete in `tests/subscription-ui.cjs`.

- [x] System Audit Slice 3 (Overview One-Click Apply Pipeline & Diagnostics):
  - [x] Designed and implemented 4-stage streaming pipeline: Generate -> Kernel Syntax Check -> Apply & Reload -> Healthcheck.
  - [x] Elevated "⚡ 一键生成并应用" to prominent full-width primary action button while retaining all 6 granular debugging tools below a clear divider.
  - [x] Implemented structured diagnostic alert boxes detailing stage number, exact kernel/backend error logs, security fused status (old config preserved), and targeted user action hints.
  - [x] Upgraded `omniaUi.paintStatus` in `resources/omnia/ui.js` to natively mount DOM element payloads and document fragments.
  - [x] Created comprehensive test suite `tests/overview-ui.cjs` and integrated into `tests/ci-static.sh`.

- [x] Completed Selector Outbounds Dynamic Allocation & Resource Tab Reorder:
  - [x] Swapped LuCI Resource Management menu tab order (`resources.js`): `[ 订阅 (Subscriptions) ]` placed before `[ 模板 (Template & Selectors) ]`, with `subscriptions` set as default active tab.
  - [x] Implemented dedicated core selector allocation module `profile_selectors.uc` with persistent storage at `/etc/omnia/selectors.json`.
  - [x] Implemented 4-tier member resolution priority in `generator_selectors.uc`:
    - Priority 1: Omnia user configuration (100% priority override, no merge with template rules).
    - Priority 2: Template `x_rule` (`region:...`, `region+direct:...`, `all_regions`, `keep`).
    - Priority 3: Template native `outbounds`.
    - Priority 4: Fallback to root node pool (`🗽 节点选择`) when selected regions contain no valid nodes.
  - [x] Main system root pool (`🗽 节点选择`, `x_rule: "main"`) remains 100% protected as global aggregator and fallback, excluded from business selector overrides.
  - [x] Manual selector isolation (`generator_manual_selector.uc`): customized selectors skip automatic manual selector appending unless explicitly selected.
  - [x] Automatic template selector synchronization (`sync_template_selectors` in `profile.uc`): syncs on profile save, remote sync, restore default, and rollback with tag inheritance, orphan purging, and strict template order preservation.
  - [x] Registered RPC methods `template_selectors_get` and `template_selectors_save` in `omnia.uc` and ACL permissions in `luci-app-omnia.json`.
  - [x] LuCI Frontend card allocator in `profile.js`:
    - Clean selector card layout with tag name, status pills, and member chip management (with remove `✕`).
    - Candidate quick-add buttons for 5 regions (`HK`, `TW`, `SG`, `JP`, `US`), `⚡ 全选地区` shortcut, and core system targets (`main`, `direct`, `manual`).
    - Single selector outbound JSON preview modal with magnifying glass (`🔍`) button and 1-click clipboard copy.
    - Save and reset buttons.
  - [x] Comprehensive test suites:
    - Added `tests/profile-selectors.uc` to `tests/run-all-convert-tests.sh` (all 14 ucode test suites passing).
    - Updated `tests/profile-ui.cjs` covering member addition, removal, quick all regions, save, reset, and modal preview (all 10 tests passing).
    - Static checks `tests/ci-static.sh` passing.
- [x] Completed Dynamic Custom Region Groups & Expanded Global Flag Support:
  - [x] Redefined 5 preset regions (`HK`, `TW`, `SG`, `JP`, `US`) as factory default templates, fully deletable with `✕` in LuCI UI.
  - [x] Expanded national flags and country dictionary (`flags.uc`) from 20 to 70+ regions (Nigeria `NG`, Ukraine `UA`, Egypt `EG`, Pakistan `PK`, Turkey `TR`, Argentina `AR`, and all common streaming/niche regions).
  - [x] Implemented Unicode Regional Indicator symbol offset algorithm (`iso_to_flag_emoji`) covering all 250+ 2-letter ISO country codes automatically.
  - [x] Backend Schema (`subscription_policy_schema.uc`) updated to preserve custom regions without forcing preset injection and defensively filter deleted regions from `allowed_regions` and `rate_filter.matched_regions`.
  - [x] Generator groups and selector tags (`generator_groups.uc`, `profile_selectors.uc`) dynamically format speedtest group tags and candidate pools with country flags and Chinese names.
  - [x] Subscription frontend (`subscriptions.js`):
    - Added `[ ➕ 添加自定义区域 ]` modal with live country code lookup, automatic flag/Chinese badge display, and keyword prefilling.
    - Added `[ ↺ 恢复出厂五区 ]` button with confirmation dialog.
    - Added `[ ✕ 删除 ]` button for each region row with cascading cleanup of source `allowed_regions` and `rate_filter.matched_regions`.
    - Dynamic column rendering for Subscription Matrix and source editor checkboxes with flag badges.
  - [x] Profile selector allocation preview (`profile.js`): dynamic formatting `${candidateLabel(m)} 测速组`.
  - [x] Fixed keyword matching infinite loop in `generator_util.uc` (`tag_contains_keyword`): replaced unsupported 3-argument `index(str, needle, offset)` with `substr` window slicing, eliminating rpcd CPU spinlock and Resources page hang on real hardware.
  - [x] Fixed undeclared variable exceptions in `runtime.uc` and `profile_selectors.uc`:
    - Imported `stat` from `fs` in `runtime.uc`, eliminating runtime status observation failure on Overview page.
    - Moved `profile_source_key()` before `template_selectors_get()` in `profile_selectors.uc` to satisfy ucode `'use strict'` declaration-before-call ordering, and added defensive fallback around node snapshot / group generation to ensure business selectors load reliably.
    - Added user-facing error reporting in `profile.js` when `selectorsResult` fails.
  - [x] Template Validation Relaxation & Selector Policy Decoupling:
    - [x] Relaxed strict `x_rule: "main"` validation in `profile.uc` and `generator_validate.uc`: templates now require `selector_count >= 1` instead of strictly requiring `main_selector_count == 1`, allowing clean sing-box templates without custom extensions.
    - [x] Implemented multi-tier Root Main Pool resolution (`configured_main_tag > x_rule: "main" > common tags ("🗽 节点选择", "节点选择", "Proxy", "auto") > first selector`).
    - [x] Supported user-selectable system root main selector (`main_selector` persisted in `/etc/omnia/selectors.json`).
    - [x] Decoupled selector outbound allocation into dedicated tab `[ 分流 (selectors) ]` (`view/omnia/selectors.js`), featuring interactive root main selector dropdown, root main pool aggregated outbounds card, business selector cards, and 1-click "保存并立即应用".
    - [x] In `profile.js`: moved "在线模板与拉取设置" accordion to above the template editor, greatly enhancing page hierarchy and usability.
    - [x] Created `tests/selectors-ui.cjs`, updated `tests/profile-ui.cjs`, `tests/profile-selectors.uc`, `tests/ci-static.sh`, and `tests/run-all-convert-tests.sh`. All suites passing 100%.

## In Progress

- [x] Native subscription conversion (v1.5) completed across backend (M1-M4) and frontend (M5).
- [x] Fixed single ruleset download failure for tags with exclamation marks (e.g., `geosite-category-ai-!cn`, `geosite-geolocation-!cn`) in `omnia-runner` and optimized LuCI UI tag reporting.
- [x] Upgraded operator pipeline to Sub-Store style visual card UI with reordering/presets and fully aligned airport DNS settings with sing-box official schema.
- [x] Converted LuCI profile template page (`profile.js`) into an editable JSON editor with offline sing-box official JSON Schema validation, formatting, Tab/Ctrl+S shortcuts, rollback/restore integration, and collapsible on-demand remote pull settings.
- [x] Fixed frontend missing `omniaUi.pillClass` exception crashing resources tabs (`ui.js` now exports `pillClass`, `pillStyle`, `paintPill`, and `profile.js` uses `pill` / `paintPill`).
- [x] Fixed single-source refresh failure when unselected sources have no previous snapshot (`subscription.uc` now gracefully marks unselected sources without prior snapshot as `not_refreshed` while strictly guarding against orphaned nodes from renamed sources).
- [x] Optimized profile editor schema validation and styling: embedded sing-box schema auto-validation without requiring manual `$schema` declaration, automatic injection on format/save (`ensureSchema`), and aligned remote template source card styling with standard Omnia content sections.
- [x] Added read-only running sing-box config preview in Network Diagnostics (prioritized as first tab: 运行配置 -> 数据面 -> 控制面) with synchronized line numbers gutter, copy to clipboard, and instant reload; added synchronized line numbers gutter to the editable Profile template JSON editor.
- [x] Overview Page Redesign (Zashboard Pattern):
  - [x] Slice 1: Backend telemetry enhancement (`constants.uc`, `overview_status.uc` reporting `singbox_version` and `uptime_seconds`).
  - [x] Slice 2: Header banner (`overviewHeaderBanner`) & Realtime metrics cards with native SVG sparklines and page visibility throttling.
  - [x] Slice 3: Interactive connection statistics drill-down drawer (Source IP / Outbound Node / Group) + Side-by-side Latency test (with SVG spark-bars & auto intervals) and Network Info (dual-egress & IP masking toggle).
  - [x] Slice 4: Compressed 3-column configuration resource status bar + Restructured action bar (promoted One-click Apply & folded single-step debugging dropdown).
  - [x] Slice 5: End-to-end integration testing and visual review.
  - [x] Overview Performance & UX Fix:
    - [x] Removed blocking `/traffic` SSE endpoint in `dashboard.uc` (preventing rpcd/ubus timeouts & global menu freeze).
    - [x] Switched bandwidth telemetry to non-blocking frontend differential calculation on cumulative bytes.
    - [x] Added page-unmount timer cleanup to halt polling upon navigating away from Overview.
    - [x] Restored direct tab navigation on Configuration Resource columns (Template, Subscriptions, Rulesets).
    - [x] Restored `omniaMotion.cardClass()` hover lift animations across overview cards.
    - [x] Added 4-site network info switcher supporting `ip.sb`, `ipip.net`, `ipwho.is`, and `ipapi.is`.
  - [x] Comprehensive Quality & Protocol Audit Fixes (10 Core Items):
    - [x] Shadowsocks protocol name standardization (`ss` -> `shadowsocks` in `producer.uc`, `ir.uc`, `singbox.uc`, `subscription_snapshot.uc`).
    - [x] Shadowsocks URI parser `plugin` and `plugin_opts` extraction and producer mapping.
    - [x] ISO country code word-boundary matching in `generator_util.uc`, eliminating region misclassification (`AUSTRALIA`/`RUSSIA` -> `US`, `ESG` -> `SG`).
    - [x] RFC 8259 control character escaping via ucode native `sprintf("%J")` in `core/utils.uc`.
    - [x] Task lock stale recovery state machine in `core/task_lock.uc` (5s recovery for dead PID, 30s launch protection for preclaimed lock).
    - [x] In-memory `stat(mtime)` metadata cache in `clash.uc`, eliminating duplicate `config.json` reads and parses during 3s polling.
    - [x] Process spawning reduction: single-execution time components fetch in `scheduler_state.uc` + lazy route diagnostics in `runtime.uc`.
    - [x] rpcd synchronous blocking mitigation with short-interval status cache in `runtime.uc`.
    - [x] Frontend latency test error handling (`img.onerror` -> `done(false)` reporting timeout instead of 5ms), cleared hardcoded placeholder IPs in `overview.js`.
    - [x] LuCI dark mode CSS variables integration across `ui.js` and `overview.js`.
    - [x] Consolidated canonical utility functions in `core/utils.uc` (`trim`, `trim_line`, `starts_with`, `ends_with`, `append_unique`).
  - [x] Local Node Saving & Disabled Status Bug Fix:
    - [x] Fixed `ui.js` `checkboxInput` missing DOM boolean property assignment (`input.checked = isChecked; input.defaultChecked = isChecked;`).
    - [x] Hardened `saveSourceEditor` in `subscriptions.js` to ensure resilient `enabled` boolean parsing.
    - [x] Enhanced `subscriptions_save` in `subscription.uc` to automatically compile local source nodes into `/etc/omnia/node-snapshot.json`.
    - [x] Updated `reloadPolicyFromBackend` in `subscriptions.js` to refresh snapshot summary alongside subscriptions config, updating matrix node counts and status immediately without manual page reload.
  - [x] Sub-Store-style sing-box Node Preview:
    - [x] Implemented `subscription_source_preview` RPC in `subscription.uc` with rpcd (`omnia.uc`) and ACL (`luci-app-omnia.json`) registration.
    - [x] Implemented rich `openNodePreviewModal` in `subscriptions.js`:
      - [x] Real-time client-side search filtering across node tags, server addresses, ports, and protocols.
      - [x] Summary bar with total node count and interactive protocol pill badges (Shadowsocks, VLESS, VMess, Trojan, Hysteria2, TUIC, WireGuard, Direct).
      - [x] Dual-view switcher: List Card View (showing protocol badge, server:port, TLS/Reality tags, Transport tags, and expandable individual outbound JSON) and Raw JSON View (showing full sing-box formatted outbounds with 1-click clipboard copy).
      - [x] ESC key and backdrop click dismissal.
    - [x] Integrated preview triggers: per-source "预览" button in matrix, "👁️ 节点预览" in editor, and "👁️ 预览快照节点" in page header.
  - [x] Real-Hardware Field Issues & UI Ergonomics Refinement:
    - [x] Auto-clear subscription error messages on page reload (removed stale `item.error` fallback from source matrix, displaying errors only during active refresh execution).
    - [x] Local source node statistics preservation: calculated parsed node count even when local source is disabled (`source.enabled == false`), displaying true node counts in matrix.
    - [x] Enhanced VLESS and sing-box JSON parsing (`form.uc`, `sniffer.uc`, `singbox.uc`): supported single sing-box outbound objects, nested TLS `reality`, `sni`, `alpn`, `skip_cert_verify`, and transport layers (`ws`, `grpc`, `http`).
    - [x] Custom region keyword delete button alignment (`subscriptions.js`): moved delete button to the end of the input field with standard `cbi-button-remove` styling.
    - [x] Subscription matrix layout optimization (`subscriptions.js`): added `white-space: nowrap; min-width: 3.5rem;` to `启用` and `节点` headers to prevent wrapping; separated custom DNS and operators into a dedicated second line below the URL.
    - [x] System root main selector card styling (`selectors.js`): replaced low-contrast `#f8fafc` text on slate background with high-contrast `#eff6ff` card, `#1e3a8a` title, `#1d4ed8` preview button, and `#475569` description.

## Remaining

- [ ] Acceptance testing on OpenWrt 25.12.x / real hardware before release.

## Acceptance Criteria

1. Five standard documents exist and have clear, non-overlapping responsibilities.
2. Session Start Protocol can restore development context from repository alone.
3. Session Handoff Protocol accurately captures state for cross-session continuity.
4. All document references resolve to valid paths.
5. Documentation does not duplicate `docs/DEVELOPMENT.md` immutable constraints.

## Validation

- `git diff --check` passes (no whitespace errors).
- All five documents present and internally consistent.
- Document cross-references verified.

## Blockers

None.

## Next Action

Await user confirmation of documentation and specification of next development phase.
