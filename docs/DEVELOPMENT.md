# Omnia 开发与发布流程

Omnia 以 OpenWrt 25.12 及更高版本为主要目标，发布物以 APK 为主；IPK 只保留为旧系统兼容构建，不作为日常验收目标。

## 不可变约束

下列规则是已确认的产品与发布契约。除非先完成影响分析并获得明确批准，不得通过“顺手优化”、CI 改造或重构改变它们。

### 发布契约

- `dev` 推送及指向 `dev` 的 PR 不自动构建；**Verify Omnia on OpenWrt** 可手动执行，并在指向 `master` 的 PR 上自动执行。其产物仅为临时验证 artifact，不是 Release。
- `master` 只接收已验证的 `dev`；PR 合并到 `master` 自动运行 **Release Omnia Packages** 并发布。首次版本为 `v0.1.0`，后续按现有稳定版本标签递增补丁号；直接推送不会自动发布。
- 大版本更新时，合并 PR 的标题以 `[manual-release]` 开头，跳过该次自动发布；随后在 `master` 手动运行发布工作流并指定更高的 `X.Y.Z` 版本。手动发布也可留空以递增补丁号。发布工作流只接受 `master`，并拒绝重复标签及非递增的指定版本。
- 发布标签在安装包构建成功后创建。如果创建标签后发布步骤失败，先核对对应标签与 Release 状态，人工处理后再重试；不要删除或覆盖已有正式版本来绕过冲突。
- 正式 Release 的文件名必须保持由包元数据生成的稳定格式：`luci-app-omnia_<版本>-1_all.ipk` 与 `luci-app-omnia_<版本>-r1_all.apk`。不得以 commit SHA、CI run number 或临时 artifact 名替代。

### 业务访问契约

- Omnia 内嵌原生代理面板，通过 LuCI 同源会话和 rpcd 权限访问已应用配置中的 sing-box `experimental.clash_api` 或 API 服务；独立 Zashboard 入口继续保留。面板探测实际可用接口，优先使用 sing-box API，仅在两个接口都可用时显示接口选择。
- 原生面板支持通过现有 LuCI 同源入口进行远程访问；外部网关的部署、TLS 和访问控制仍由用户管理。独立 Zashboard 和 Clash API 的公网访问不属于 Omnia 的兼容承诺。
- Dashboard 的下载来源、Clash API 监听地址、访问密钥和默认模式由 LuCI 面板设置保存，并在生成配置时写入 sing-box。
- sing-box API 适配器使用独立 ucode 进程及 gRPC-Web，密钥从设备上的已应用配置读取，不发送到浏览器；当前不支持 API 服务启用 TLS 的配置。原生 API 测速为异步触发，需刷新查看结果。

### 配置兼容性契约

- Profile 模板负责与目标 sing-box 版本保持语义兼容；模板应声明 `"$schema": "https://sing-box.sagernet.org/schema.json"`。CI 会下载该 Schema，并在剥离 Omnia 的 `x_` 扩展字段后校验模板；模板维护者仍须使用对应版本的 `sing-box check` 验证。
- Omnia 的生成器只校验自身组合配置所必需的结构（例如唯一的 `tun-in`、控制面端口冲突和内部引用）。不得在生成阶段硬编码 sing-box 可选字段、默认值或枚举值。
- 生成后的候选配置和应用前的配置必须继续通过设备上实际安装版本的 `sing-box check`。这才是版本相关字段的最终裁决。
- 当前 Profile 使用的 `x_rule` 是 Omnia 的生成扩展，会在候选配置写入前移除；因此官方 Schema 应用于剥离扩展后的候选配置，而不是把带 `x_rule` 的源模板当成纯 sing-box 配置。
- `route.rule_set` 是规则集下载的唯一来源清单。Omnia 支持 sing-box 的单个 tag 与 tag 数组声明，并对数组 URL、path 中的 `{tag}` 逐项展开；不得在 LuCI 策略中重复维护规则集仓库地址。
- `profiles/main-profile.json` 是开发与发布共用的唯一默认模板；打包路径下的同名模板必须与其字节一致，CI 会阻止两者漂移。
- 本地/自动规则集同步覆盖模板的全部 `remote` 声明，而不只覆盖路由已引用的 tag；`inline` 与模板已有的 `local` 声明保持原样。
- 规则集清单接口必须依据当前策略输出 `runtime_status`，而不是把本地缓存缺失直接等同于运行不可用：`unused`、`ready_local`、`ready_remote`、`ready_template`、`degraded_remote_fallback` 与 `invalid` 是概览页的稳定状态契约。前端只负责其文案和颜色；本地缓存与同步信息仅作辅助展示。

## 分支职责

- `dev`：唯一开发与集成分支。功能修改先进入这里，并必须通过 GitHub Actions。
- `master`：已验证的发布分支。不得直接推送业务修改，只接收来自 `dev` 的 Pull Request。
- `vX.Y.Z` 标签：由发布工作流基于 `master` 的发布提交创建，GitHub Release 附加独立的 APK 和 IPK 文件。

## 必经流程

1. 从 `dev` 创建功能分支，完成修改后提交 Pull Request 到 `dev`；个人小改动也可以直接推送到 `dev`。
2. 手动运行 **Verify Omnia on OpenWrt** 并等待通过。
3. 在真实 OpenWrt 25.12+ 设备安装 GitHub Actions 生成的 APK，确认 LuCI、生成并应用配置、sing-box 运行及 Dashboard 可用。
4. 创建 `dev` 到 `master` 的 Pull Request；只在 `dev` 已通过且设备验收完成时合并。
5. 合并后等待 **Release Omnia Packages** 自动发布；需要指定大版本时，使用 `[manual-release]` 前缀的 PR 标题，合并后在 `master` 手动运行发布工作流并指定版本。
6. 从 Release 下载 APK；IPK 仅在确有旧系统兼容需求时使用。

建议在 GitHub 仓库设置中为 `master` 启用分支保护：要求 Pull Request、要求 **Verify Omnia on OpenWrt** 状态检查通过，并限制直接推送。

## GitHub 自动测试范围

手动运行或创建、更新以 `master` 为目标的 Pull Request 时，会执行：

1. JSON、Git diff、GitHub Actions YAML 与 LuCI JavaScript 语法检查。
2. APK 与 IPK 的构建；APK 是主要交付物。

容器化 OpenWrt 测试不作为门禁：它不能可靠模拟 procd、TUN、路由、防火墙和实际 WAN，维护成本高于收益。每次准备将 `dev` 合并到 `master` 时，改为在真实 OpenWrt 25.12+ 设备安装 CI 生成的 APK，完成一次设备验收。
