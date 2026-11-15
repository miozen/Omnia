# Omnia Development Handoff

## Last Updated

2026-11-15T19:35+08:00

## Repository State

- **Current Branch:** `dev`
- **HEAD:** `bddf441` (feat(profile): transform template view into editable json editor with singbox official schema validation)
- **Working Tree:** CLEAN
- **Remote Sync:** Pushed to `origin/dev`

## Development State

- **Current Phase:** Post-v0.1.0 Feature Development — Editable Profile Template & Official JSON Schema Validation
- **Current Task:** Convert profile template view to editable JSON editor with offline sing-box JSON schema validation
- **Last Completed:**
  1. Converted `luci-app-omnia/htdocs/luci-static/resources/view/omnia/profile.js` into an interactive JSON editor with direct local saving to `/etc/omnia/profiles/main-profile.json` (via existing `profile_save` RPC).
  2. Integrated sing-box official JSON Schema (`https://sing-box.sagernet.org/schema.json`) packaged locally as `luci-static/resources/omnia/sing-box-schema.json` for 100% offline schema validation.
  3. Implemented robust client-side Schema validator adhering to sing-box Draft 2020-12 rules and ignoring Omnia `x_` extension properties.
  4. Added validation pipeline: JSON syntax check, `$schema` URL check, sing-box JSON schema validation, and backend Omnia structure contract (`profile_validate`).
  5. Added editor UX features: 2-space indentation formatting, Tab key indentation, Ctrl+S save shortcut, and dirty state tracking badge.
  6. Preserved existing rollback (`callProfileRollback`) and default profile restore (`callProfileRestoreDefault`) mechanics.
  7. Encapsulated remote template URL and fetch strategy inside a native collapsed `<details>` accordion for on-demand pull without remote uploads.
  8. Created comprehensive test suite `tests/profile-ui.cjs` and integrated it into `ci-static.sh`.
  9. Verified all 13 converter tests, static checks, unit tests, and python schema validation pass without errors.

## Uncommitted Work

None once committed.

## Validation Performed

- OpenWrt rootfs container tests via `tests/run-all-convert-tests.sh`:
  - `tests/convert-step1.uc` PASS
  - `tests/convert-step2-uri.uc` PASS
  - `tests/convert-step3-singbox.uc` PASS
  - `tests/convert-step4-producer.uc` PASS
  - `tests/convert-step5-pipeline.uc` PASS
  - `tests/convert-step6-7-integration.uc` PASS
  - `tests/subscription-fallback-security.uc` PASS
  - `tests/convert-step-m2-clash.uc` PASS
  - `tests/convert-step-m2-operators.uc` PASS
  - `tests/convert-step-m2-traffic.uc` PASS
  - `tests/convert-step-m2-integration.uc` PASS
  - `tests/generator-dedicated-dns.uc` PASS
  - `tests/convert-step-m4-local-and-script.uc` PASS
  - UCode syntax compilation on all modules (`ucode -c,module`) PASS
- Python schema validator `tests/validate-profile-schema.py` PASS against local official schema cache.
- Frontend profile UI unit test `tests/profile-ui.cjs` PASS.
- Full CI static suite (`tests/ci-static.sh`) PASS.
- `git diff --check` passed with 0 errors.

## Validation Pending

- Package assembly (IPK/APK) and real device or OpenWrt 25.12.x VM acceptance before final master merge.

## Known Issues / Blockers

None.

## Exact Next Action

1. Build IPK package manually on `dev` branch.
2. User deploys and tests IPK on real OpenWrt hardware / VM.
3. Upon real device confirmation, proceed with merge from `dev` to `master`.

## Cross-machine Ready

**YES** — Committed and pushed to `origin/dev`. Working tree is CLEAN.
