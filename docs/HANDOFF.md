# Omnia Development Handoff

## Last Updated

2026-11-17T20:08+08:00

## Repository State

- **Current Branch:** `dev`
- **HEAD:** `4db6bac` (committed and pushed)
- **Working Tree:** CLEAN
- **Remote Sync:** Branch `dev` synchronized to `origin/dev`

## Development State

- **Current Phase:** Overview Page Redesign (Zashboard Pattern)
- **Current Task:** Performance fix & UX enhancement
- **Last Completed:**
  1. `dashboard.uc` & `overview_status.uc`:
     - Removed blocking call to `/traffic` SSE endpoint, avoiding rpcd worker starvation.
     - Bypassed heavy `observe_runtime` in high-frequency `dashboard_metrics()`.
     - Cached singbox version string to `/var/run/omnia/singbox_version`.
  2. `overview.js`:
     - In-flight RPC guard (`metricsInFlight`) and chained `setTimeout(pollMetricsCycle, 3000)`.
     - Bandwidth Telemetry: Calculates smooth upload and download rates based on total cumulative byte deltas ($\Delta \text{bytes} / \Delta t$).
     - Unmount Cleanup: Added `!document.getElementById('omnia-overview-root')` checks in polling and latency timers.
     - Motion Animations: Restored `omniaMotion.cardClass()` across cards.
     - Direct Tab Jump: Restored reliable `window.location.href = resourceHref(...)` click handlers on Template, Subscriptions, and Rulesets columns.
     - 4-Site Network Switcher: Added pill tabs supporting `ip.sb`, `ipip.net`, `ipwho.is`, and `ipapi.is` with per-site querying, privacy mask toggle, and comparison list.
  3. Tests:
     - `node tests/overview-ui.cjs`: PASS (6/6).
     - `ci-static.sh`: PASS.
     - `run-all-convert-tests.sh`: PASS.
     - `git diff --check`: PASS (0 errors).

## Uncommitted Work

None.

## Validation Performed

- `node tests/overview-ui.cjs`: PASS (Test 0-5 all passed)
- `tests/ci-static.sh`: PASS
- `tests/run-all-convert-tests.sh`: PASS (13 suites + ucode compilation)
- `git diff --check`: 0 errors

## Exact Next Action

Ready for next task.

## Cross-machine Ready

**YES** — Working tree clean, changes committed and pushed to `dev`.
