# Omnia Decisions Log

Confirmed decisions that govern development. AI agents must not override **Accepted** decisions without explicit approval.

For immutable contracts (release, access, compatibility), the authoritative source is `docs/DEVELOPMENT.md`.

## Accepted

### D-001: APK as primary delivery, IPK for legacy only

- **Status:** Accepted
- **Content:** OpenWrt 25.12+ APK is the primary build artifact. IPK is retained only for legacy system compatibility, not as a daily acceptance target.
- **Rationale:** OpenWrt 25.12+ migrated to APK package management.
- **Reference:** `docs/DEVELOPMENT.md` line 3, `README.md` lines 3–4

### D-002: Release contract — automated versioned releases

- **Status:** Accepted
- **Content:** Merging verified `dev` into `master` triggers automatic release. First version is `v0.1.0`, subsequent releases auto-increment patch. Major versions use `[manual-release]` PR title prefix. Release filenames must use stable format from package metadata.
- **Rationale:** Reproducible, conflict-free release pipeline.
- **Reference:** `docs/DEVELOPMENT.md` "发布契约" section

### D-003: No container-based integration tests as gate

- **Status:** Accepted
- **Content:** Container-based OpenWrt tests are not CI gates. Real device acceptance on OpenWrt 25.12+ is required before merging `dev` to `master`.
- **Rationale:** Containers cannot reliably simulate procd, TUN, routing, firewall, and real WAN. Maintenance cost exceeds benefit.
- **Reference:** `docs/DEVELOPMENT.md` lines 56–59

### D-004: JSON file persistence, no database

- **Status:** Accepted
- **Content:** All persistent data uses JSON files under `/etc/omnia/`. Concurrency managed by file locks. No database.
- **Rationale:** Standard OpenWrt LuCI plugin practice. Embedded devices have limited resources and filesystem-based config is the ecosystem norm.
- **Reference:** `core/constants.uc` (PATH definitions), `core/lock.uc`

### D-005: Profile template is the single source of truth

- **Status:** Accepted
- **Content:** `profiles/main-profile.json` is the sole development and release default template. The packaged copy must be byte-identical. CI blocks drift.
- **Rationale:** Prevents divergence between development and release.
- **Reference:** `docs/DEVELOPMENT.md` "配置兼容性契约", `tests/ci-static.sh` lines 13–16

### D-006: Generator does not hardcode sing-box optional fields

- **Status:** Accepted
- **Content:** The generator only validates structures required for its own composition (unique `tun-in`, port conflicts, internal references). Version-specific optional fields, defaults, and enumerations are not hardcoded. Device `sing-box check` is the final arbiter.
- **Rationale:** Maintain forward compatibility with sing-box version updates.
- **Reference:** `docs/DEVELOPMENT.md` "配置兼容性契约", `tests/ci-static.sh` lines 36–39

### D-007: `x_rule` extension processing

- **Status:** Accepted
- **Content:** `x_rule` in Profile outbounds is an Omnia generation extension. It is stripped before writing candidate config. Official Schema validates the stripped candidate, not the raw template.
- **Rationale:** Enables Omnia-specific selector injection without polluting sing-box config.
- **Reference:** `docs/DEVELOPMENT.md` line 29, `generator_validate.uc` (`strip_extensions`)

### D-008: Rule set source of truth is `route.rule_set`

- **Status:** Accepted
- **Content:** `route.rule_set` in the Profile template is the sole rule set download manifest. Tag arrays with `{tag}` expansion are supported. LuCI policies must not duplicate rule set repository URLs.
- **Rationale:** Single source of truth prevents sync issues.
- **Reference:** `docs/DEVELOPMENT.md` line 30

### D-009: Native panel access model

- **Status:** Accepted
- **Content:** Omnia embeds a native proxy panel accessed via LuCI same-origin session and rpcd permissions. Panel probes available interfaces, prefers sing-box API, shows interface selector only when both APIs are available. External gateway deployment, TLS, and access control are user-managed.
- **Rationale:** Secure by default via LuCI session; user responsibility for external exposure.
- **Reference:** `docs/DEVELOPMENT.md` "业务访问契约"

### D-010: sing-box API adapter architecture

- **Status:** Accepted
- **Content:** The sing-box API adapter (`native_control.uc`) runs as a separate ucode process via `omnia-native-api`, communicates using gRPC-Web over HTTP. Secrets are read from device config, never sent to browser. TLS on API service is not currently supported.
- **Rationale:** Isolation from rpcd process, security of API secrets.
- **Reference:** `docs/DEVELOPMENT.md` line 22, `native_control.uc`, `omnia-native-api`

### D-011: Ruleset runtime_status contract

- **Status:** Accepted
- **Content:** Rule set inventory API outputs `runtime_status` based on current policy, not local cache presence. Stable states: `unused`, `ready_local`, `ready_remote`, `ready_template`, `degraded_remote_fallback`, `invalid`. Frontend only handles display; backend decides status.
- **Rationale:** Decouples cache state from operational status.
- **Reference:** `docs/DEVELOPMENT.md` line 33

### D-012: Branch workflow — dev then master

- **Status:** Accepted
- **Content:** `dev` is the sole development branch. `master` only receives verified PRs from `dev`. Direct pushes to `master` for business changes are prohibited.
- **Rationale:** Enforces verification before release.
- **Reference:** `docs/DEVELOPMENT.md` "分支职责"

### D-013: No automatic migration from predecessor project

- **Status:** Accepted
- **Content:** Omnia uses `omnia` for all identifiers. No automatic migration of predecessor project configuration.
- **Rationale:** Clean break; avoids compatibility burden with unknown legacy states.
- **Reference:** `README.md` line 6
