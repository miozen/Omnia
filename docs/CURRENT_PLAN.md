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
- [x] Switch branch to `dev`.
- [x] Eliminated code duplication between `apply.uc` and `runtime.uc` (`wait_runtime_ready` / `runtime_observation_ready`).

## In Progress

- [ ] Awaiting user feedback and confirmation for next actions.

## Remaining

- [ ] Further test coverage additions (e.g., generator regression tests).
- [ ] User-specified feature or refinement tasks.

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
