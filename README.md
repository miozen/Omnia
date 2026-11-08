# Omnia

Omnia 是面向 OpenWrt 25.12+ 的 sing-box TUN 与 LuCI 管理插件。APK 是主要交付物；IPK
仅用于旧系统兼容。

安装包、配置路径、服务和 RPC 标识均使用 `omnia`；不自动迁移原项目配置。

## Dashboard 访问模型

Omnia 内嵌原生代理面板，通过 LuCI 同源会话访问已启用的 sing-box Clash API 或 sing-box API，并保留独立 Zashboard 入口。外部网关及独立 Zashboard 的公网访问由用户管理。

详细的开发、验收与发布流程见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。

## Release

仅从已验证的 `master` 提交创建 `vX.Y.Z` tag 才会发布正式版本。Release 固定提供：

- `luci-app-omnia_<版本>-1_all.ipk`
- `luci-app-omnia_<版本>-r1_all.apk`

普通 CI artifact 仅用于验证，不能替代 Release，也不构成稳定的下载或命名接口。
