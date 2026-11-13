# Omnia Architecture

## Project Positioning

Omnia is a **sing-box TUN transparent proxy management plugin** for **OpenWrt 25.12+**, delivered as a LuCI web application. It provides configuration generation, subscription node management, rule set synchronization, dashboard proxying, and runtime lifecycle management for sing-box.

- **Target platform:** OpenWrt 25.12+ (APK primary, IPK for legacy compatibility)
- **Identifier:** All runtime paths, services, and RPC use `omnia`
- **Repository:** `miozen/Omnia`

## Tech Stack

| Layer | Technology |
|---|---|
| Backend logic | ucode (OpenWrt native scripting language) |
| RPC framework | rpcd-mod-ucode → ubus |
| Frontend | LuCI JS (`view.extend`, `rpc.declare`) |
| Process management | procd |
| Proxy core | sing-box (TUN mode) |
| Persistence | JSON files under `/etc/omnia/` |
| Build/Package | Shell scripts → IPK (`ipkg-build`) / APK (`apk mkpkg`) |
| CI/CD | GitHub Actions |

**Key dependencies** (from Makefile): `luci-base`, `rpcd`, `rpcd-mod-ucode`, `ucode`, `ucode-mod-fs`, `ucode-mod-ubus`, `ucode-mod-uclient`, `ucode-mod-uloop`, `jsonfilter`, `sing-box`, `ip-full`, `ca-bundle`, `wget-ssl`, `coreutils-timeout`.

## Module Structure

### Backend (`luci-app-omnia/root/usr/share/ucode/omnia/`)

**RPC Gateway** — `rpcd/ucode/omnia.uc` (50+ ubus methods, single `omnia` object)

**Business modules:**

| Module | Responsibility |
|---|---|
| `profile.uc` | Template (Profile) CRUD, remote sync, rollback |
| `subscription.uc` | Subscription source management, node snapshot refresh |
| `generator.uc` | Configuration generation engine (orchestrates 10 sub-modules) |
| `apply.uc` | Candidate → runtime commit, backup, rollback |
| `runtime.uc` | sing-box service lifecycle (start/stop/restart/status) |
| `control.uc` | Clash API proxy selector/mode control |
| `native_control.uc` | sing-box gRPC API adapter (separate ucode process) |
| `dashboard.uc` / `dashboard_config.uc` | Dashboard status and settings |
| `ruleset.uc` + related | Rule set inventory, policy, download, sync |
| `scheduler.uc` | Hourly cron-driven task evaluation |
| `notify.uc` | Telegram notification |
| `diagnostics.uc` | Log reading, connectivity probing |
| `overview_status.uc` | Aggregated status for overview page |

**Generator sub-modules** (orchestrated by `generator.uc`):

`generator_input.uc`, `generator_validate.uc`, `generator_nodes.uc`, `generator_groups.uc`, `generator_selectors.uc`, `generator_manual_selector.uc`, `generator_dns.uc`, `generator_rulesets.uc`, `generator_control_plane.uc`, `generator_util.uc`

**Core infrastructure** (`core/`):

`constants.uc`, `result.uc`, `error.uc`, `utils.uc`, `lock.uc`, `task.uc`, `task_lock.uc`, `artifact.uc`, `ruleset_artifact.uc`, `grpc_proto.uc`, `grpc_transport.uc`, `runtime_ownership.uc`, `runtime_cleanup.uc`, `auto_apply_state.uc`, `scheduler_state.uc`, `resource.uc`, `netexec.uc`, `trace.uc`

### Frontend (`luci-app-omnia/htdocs/luci-static/resources/`)

**Shared libraries** (`omnia/`): `ui.js`, `time.js`, `motion.js`

**Views** (`view/omnia/`): `overview.js`, `panel.js`, `panel_settings.js`, `resources.js`, `profile.js`, `subscriptions.js`, `rulesets.js`, `diagnostics.js`, `notify.js`

**LuCI menu** (4 tabs): 概览 → 面板 → 资源管理 → 网络诊断

### Executables (`luci-app-omnia/root/usr/libexec/`)

| Script | Purpose |
|---|---|
| `omnia-auto-task` | Cron entry point (`5 * * * *`), calls `scheduler_tick` |
| `omnia-ensure-auto-task` | Ensures cron entry exists |
| `omnia-runner` | Background task runner (subscription refresh, ruleset sync) |
| `omnia-native-api` | Standalone ucode process for sing-box gRPC API calls |
| `omnia-ruleset-sync-job` | Rule set sync job wrapper |

## Core Business Flow

1. **Resource preparation:** User configures subscription sources → refresh fetches nodes → snapshot saved. Rule sets downloaded/synced.
2. **Configuration generation:** Profile template + node snapshot + policies → generator engine → candidate config written to `/var/run/omnia/config.candidate.json`.
3. **Validation:** `sing-box check -c candidate` on device.
4. **Apply:** Candidate committed to `/etc/omnia/runtime/config.json` (with backup). sing-box restarted via procd. Health check (TUN existence, process running). Automatic rollback on failure.
5. **Runtime control:** Clash API / sing-box gRPC API for selector switching, mode control, delay testing.
6. **Automation:** Cron-driven scheduler evaluates hourly whether subscription refresh or rule set sync is due.

## Persistence

All data stored as JSON files. No database. Concurrency managed by file locks (`core/lock.uc`).

Key paths defined in `core/constants.uc`:

| Path | Content |
|---|---|
| `/etc/omnia/main-profile.json` | User's sing-box template |
| `/etc/omnia/subscriptions.json` | Subscription source configuration |
| `/etc/omnia/node-snapshot.json` | Refreshed node data |
| `/etc/omnia/ruleset-policy.json` | Rule set sync policy |
| `/etc/omnia/dashboard.json` | Dashboard and API settings |
| `/etc/omnia/runtime/config.json` | Active sing-box configuration |
| `/etc/omnia/runtime/config.json.bak` | Backup for rollback |
| `/var/run/omnia/` | Runtime state, tasks, locks, candidate config |
| `/etc/omnia/rules/` | Locally cached rule set files |

## Architecture Constraints

Immutable constraints are defined in `docs/DEVELOPMENT.md` — that file is the authoritative source for:

- **Release contract** — version management, CI/CD pipeline, artifact naming.
- **Business access contract** — native panel interface probing, Clash API / sing-box API access model.
- **Configuration compatibility contract** — Profile template semantics, `x_rule` extensions, rule set source of truth, Schema validation rules.

## Build and Deploy

- **Build:** `scripts/build.sh ipk|apk|all`
- **CI verification:** `Verify Omnia on OpenWrt` workflow (PR to master / manual)
- **Release:** `Release Omnia Packages` workflow (PR merge to master / manual)
- **Device install:** `apk add` on OpenWrt 25.12+ → `90-omnia` init → procd service enabled
- **No container-based integration tests** — real device acceptance is required (see `docs/DEVELOPMENT.md`)
