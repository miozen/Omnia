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

## In Progress

- [ ] Native subscription conversion (v1.5) backend milestones M1-M4 completed; await user review / master merge planning.

## Remaining

- [ ] LuCI UI frontend updates for Native Conversion & Nodes (subscription types, operators, script editor, preview, form node entry).
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
