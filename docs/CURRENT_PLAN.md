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

## In Progress

- [ ] Await user confirmation to proceed to Milestone 2 (M2).

## Remaining

- [ ] Milestone 2 (M2): Restricted Clash YAML parser, ordered operators pipeline (filters, regex rename, sorting, flag emojis), traffic & expiration parsing.

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
