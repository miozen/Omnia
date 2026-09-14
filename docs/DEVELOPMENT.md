# Shinra 开发与发布流程

Shinra 以 OpenWrt 25.12 及更高版本为主要目标，发布物以 APK 为主；IPK 只保留为旧系统兼容构建，不作为日常验收目标。

## 不可变约束

下列规则是已确认的产品与发布契约。除非先完成影响分析并获得明确批准，不得通过“顺手优化”、CI 改造或重构改变它们。

### 发布契约

- `dev` 的 **Verify Shinra on OpenWrt** 只用于静态检查和临时 APK/IPK 验证 artifact；它不是 Release。
- `master` 只接收已验证的 `dev`，不得因为普通推送自动创建 Release 或替换正式下载入口。
- 只有 `master` 上的 `vX.Y.Z` tag 触发 **Release Shinra Packages**。
- 正式 Release 的文件名必须保持由包元数据生成的稳定格式：`luci-app-shinra_<版本>-1_all.ipk` 与 `luci-app-shinra_<版本>-r1_all.apk`。不得以 commit SHA、CI run number 或临时 artifact 名替代。

### 业务访问契约

- Shinra 使用 Zashboard；面板兼容接口来自 sing-box 的 `experimental.clash_api`。
- 内网直连是默认和优先路径。反向代理、公网访问、TLS、路径重写、WebSocket 转发和访问控制均属于外部网关配置，不属于 Shinra 的功能或兼容承诺。
- Dashboard 的下载来源、Clash API 监听地址、访问密钥和默认模式由 LuCI 面板设置保存，并在生成配置时写入 sing-box。

### 配置兼容性契约

- Profile 模板负责与目标 sing-box 版本保持语义兼容；模板应声明 `"$schema": "https://sing-box.sagernet.org/schema.json"`。CI 会下载该 Schema，并在剥离 Shinra 的 `x_` 扩展字段后校验模板；模板维护者仍须使用对应版本的 `sing-box check` 验证。
- Shinra 的生成器只校验自身组合配置所必需的结构（例如唯一的 `tun-in`、控制面端口冲突和内部引用）。不得在生成阶段硬编码 sing-box 可选字段、默认值或枚举值。
- 生成后的候选配置和应用前的配置必须继续通过设备上实际安装版本的 `sing-box check`。这才是版本相关字段的最终裁决。
- 当前 Profile 使用的 `x_rule` 是 Shinra 的生成扩展，会在候选配置写入前移除；因此官方 Schema 应用于剥离扩展后的候选配置，而不是把带 `x_rule` 的源模板当成纯 sing-box 配置。
- `route.rule_set` 是规则集下载的唯一来源清单。Shinra 支持 sing-box 的单个 tag 与 tag 数组声明，并对数组 URL、path 中的 `{tag}` 逐项展开；不得在 LuCI 策略中重复维护规则集仓库地址。
- `profiles/main-profile.json` 是开发与发布共用的唯一默认模板；打包路径下的同名模板必须与其字节一致，CI 会阻止两者漂移。
- 本地/自动规则集同步覆盖模板的全部 `remote` 声明，而不只覆盖路由已引用的 tag；`inline` 与模板已有的 `local` 声明保持原样。
- 规则集清单接口必须依据当前策略输出 `runtime_status`，而不是把本地缓存缺失直接等同于运行不可用：`unused`、`ready_local`、`ready_remote`、`ready_template`、`degraded_remote_fallback` 与 `invalid` 是概览页的稳定状态契约。前端只负责其文案和颜色；本地缓存与同步信息仅作辅助展示。

## 分支职责

- `dev`：唯一开发与集成分支。功能修改先进入这里，并必须通过 GitHub Actions。
- `master`：已验证的发布分支。不得直接推送业务修改，只接收来自 `dev` 的 Pull Request。
- `vX.Y.Z` 标签：仅在 `master` 的已验证提交上创建；标签触发 GitHub Release，附加独立的 APK 和 IPK 文件。

## 必经流程

1. 从 `dev` 创建功能分支，完成修改后提交 Pull Request 到 `dev`；个人小改动也可以直接推送到 `dev`。
2. 等待 **Verify Shinra on OpenWrt** 通过。
3. 在真实 OpenWrt 25.12+ 设备安装 GitHub Actions 生成的 APK，确认 LuCI、生成并应用配置、sing-box 运行及 Dashboard 可用。
4. 创建 `dev` 到 `master` 的 Pull Request；只在 `dev` 已通过且设备验收完成时合并。
5. 确认版本号后，在合并提交创建 `vX.Y.Z` 标签。
6. 等待 **Release Shinra Packages** 完成，并从 Release 下载 APK；IPK 仅在确有旧系统兼容需求时使用。

建议在 GitHub 仓库设置中为 `master` 启用分支保护：要求 Pull Request、要求 **Verify Shinra on OpenWrt** 状态检查通过，并限制直接推送。

## GitHub 自动测试范围

每次 `dev` 推送和所有以 `dev` 或 `master` 为目标的 Pull Request，都会执行：

1. JSON、Git diff、GitHub Actions YAML 与 LuCI JavaScript 语法检查。
2. APK 与 IPK 的构建；APK 是主要交付物。

容器化 OpenWrt 测试不作为门禁：它不能可靠模拟 procd、TUN、路由、防火墙和实际 WAN，维护成本高于收益。每次准备将 `dev` 合并到 `master` 时，改为在真实 OpenWrt 25.12+ 设备安装 CI 生成的 APK，完成一次设备验收。
