# AGENTS.md — Omnia AI Development Protocol

## Core Documents

Before any work, read these in order:

1. `docs/ARCHITECTURE.md` — System architecture and tech stack.
2. `docs/DECISIONS.md` — Confirmed business and architecture decisions.
3. `docs/CURRENT_PLAN.md` — Current development phase and plan.
4. `docs/HANDOFF.md` — Last session state and next action.
5. `docs/DEVELOPMENT.md` — Immutable constraints and release process.

## Session Start Protocol

1. Read the five documents listed above.
2. Run: `git branch`, `git log --oneline -5`, `git status`, `git diff --stat`.
3. Verify `docs/HANDOFF.md` matches actual Git state.
4. If consistent and task is confirmed, resume from **Next Action** in HANDOFF.
5. If inconsistent, investigate before proceeding — do not silently overwrite.

## Session Handoff Protocol

When completing a work session, checkpoint, or preparing to switch machines:

1. Review `git diff` and `git status`.
2. Run relevant tests and static checks.
3. Update `docs/CURRENT_PLAN.md` to reflect actual progress.
4. Update `docs/HANDOFF.md` with precise state.
5. Record: what is done, what is not, what passed, what is pending.
6. Mark **Cross-machine Ready: YES** only if all changes are committed and pushed.
7. Never mark unrun validations as passed.

No updates needed for casual discussions with no substantive progress.

## Default Execution Mode

For confirmed tasks, follow:

**Restore state → Check current status → Implement → Test → Validate → Review diff → Update docs → Report.**

Handle routine implementation details autonomously.

**Pause and ask only when:**

- Business rules have genuine ambiguity.
- A confirmed architecture decision would need to change.
- A significant implementation trade-off exists.
- A destructive or irreversible operation is involved.
- A critical dependency or environment is missing.

Do not re-ask about frozen decisions listed in `docs/DECISIONS.md`.

## Code Modification Rules

- All changes start from the `dev` branch.
- Follow the branch workflow defined in `docs/DEVELOPMENT.md`.
- Run static checks (`tests/ci-static.sh`) and relevant tests before reporting completion.
- Do not modify immutable contracts without explicit approval.
- Do not install dependencies or run destructive commands without approval.
- Do not auto-commit or auto-push without instruction.

## Git Rules

- Git is the source of truth for code synchronization.
- A DIRTY working tree is not a valid cross-machine handoff point.
- Never discard, overwrite, or clean uncommitted changes without instruction.
- Never run `git reset --hard`, `git clean -fd`, `git push --force`, or delete remote branches without explicit approval.
- Cross-machine handoff requires committed and pushed code.

## Document Maintenance

- Update `docs/HANDOFF.md` at every meaningful checkpoint.
- Update `docs/CURRENT_PLAN.md` when phase transitions or task completion occurs.
- Update `docs/DECISIONS.md` when a new decision is confirmed.
- Update `docs/ARCHITECTURE.md` when the system architecture actually changes.
- Do not duplicate facts across documents. Reference the authoritative source.
- `docs/DEVELOPMENT.md` is the authority for release, access, and compatibility contracts.
