# Omnia 原生订阅转换与节点处理：设计方案 v1.5

范围：为 Omnia 增加原生的订阅转换与节点处理能力，替代对 Sub-Store 的依赖。本文只描述设计，不含代码。

## 1. 目标与边界

**目标**：无论机场给的是 base64、Clash 还是 sing-box 格式，都统一转换成 sing-box outbounds JSON，再交给 Omnia 现有的快照、分组、过滤、生成流程。

**边界**：Omnia 现有下游（快照校验、地区分组、banned keywords、倍率过滤、URLTest、规则集）保持不变。新能力只替换订阅刷新链路中"拿到内容到得到 outbounds"这一段。

**参考项目**：Sub-Store 原版（sub-store-org/Sub-Store 的后端源码）。只参考设计思路和处理流程，不拷贝代码。luci-app-substore 不再作为参考。Omnia 仅个人使用，许可证不作为本期约束。v1.1 的修订都来自对原版源码的阅读。

## 2. 已确认的决策

- 参考对象：Sub-Store 原版，只参考设计与流程，不拷贝代码。
- 输入格式：URI 与 base64、Clash/Mihomo YAML、sing-box JSON（同样解析进 IR，统一输出），加本地节点（手动录入或粘贴）。
- 协议：ss、vmess、vless（含 Reality）、trojan、hysteria、hysteria2、tuic、socks、http、anytls。不做 wireguard。不做 SSR、Snell、Juicity，不做 Surge、Loon、QX、Egern、Shadowrocket、Surfboard 等配置格式。
- 获取层：自定义 User-Agent、订阅流量与到期展示。经代理拉取、失败保留旧快照、定时更新沿用 Omnia 现有能力。不做组合订阅、文件管理、Gist 同步、公开下载链接。
- 操作符：见第 6 节，含排序与国旗。地区过滤、无用节点过滤、倍率过滤仍由 Omnia 下游负责，不重复实现。
- 脚本：保留，含整批与单节点两种模式、参数传入和工具函数。
- DNS：声明式方案。Omnia 统一管理所有节点的服务器域名解析，不继承机场配置里的 DNS 引用；订阅源配置了专用 DNS 时优先使用，否则用 Omnia 默认解析策略。
- 快照的 `source` 字段校验放宽。

## 3. 总体架构

现有刷新链路：

拉取内容 → `substore_outbounds()` 解析 → `validate_outbounds()` → 打上来源标记 → 写快照

新链路在"解析"位置插入转换与处理管线，其余保持：

拉取 → **格式嗅探 → 解析为统一节点（IR）→ 有序操作符列表 → sing-box 生产器 → tag 唯一化与最终校验** → 打来源标记 → 写快照

**设计选择（v1.1 修订，v1.2 确认）：采用 Sub-Store 原版的三层结构，引入统一节点模型（IR）。** v1 曾建议不设中间模型，读完原版源码后改变看法。原版的做法是：解析器把各种输入变成一种 Clash.Meta 风格的节点对象（`name`、`type`、`server`、`port`、`skip-cert-verify` 等），所有操作符和脚本都在这种对象上工作，最后由生产器统一转成目标格式。对 Omnia 的理由有三条：输入有多种（URI、Clash、sing-box JSON、本地表单），输出只有 sing-box 一种；Clash YAML 里的节点本身就接近这种对象，解析几乎是直通；“转成 sing-box 字段”只在生产器一处维护。内部辅助字段用下划线开头，只给生产器读取，不输出到 outbound。DNS 相关内容不放进 IR，由生成器统一处理，见第 7 节。sing-box JSON 订阅同样解析进 IR，再由生产器统一输出，所以所有来源最后得到的都是同一种形态的 outbounds JSON，后续环节只需面对一种输入。

**顺序要点**：操作符是用户可排序、可单独禁用的列表，按列表顺序依次执行，和 Sub-Store 一致，不再是 v1 的固定顺序。无论列表怎么排，列表之后固定执行最后一步：生产器转换、tag 唯一化与校验。这样 Omnia 对重复 tag 的硬性要求不会被脚本或重命名破坏。

## 4. 输入解析

**嗅探顺序**：JSON（sing-box 的数组或带 `outbounds` 的对象，反向解析进 IR）→ Clash YAML（包含 `proxies:`）→ base64 解码后按行解析 URI → 明文 URI 列表。

**URI 与 base64**：处理各协议的标准写法，并容忍常见非标准写法（如 vmess 的 base64 JSON 变体、ss 的 plugin 参数）。

**Clash YAML**：受限解析器，只读取 `proxies` 段，支持块式和 flow 式两种写法。遇到不认识的结构明确报错，由现有机制保留旧快照，不静默丢节点。

**sing-box JSON（订阅源是完整配置时）**：只提取有效代理节点，其余全部丢弃。输入可以是纯 outbounds 数组，也可以是带 `outbounds`、`route`、`dns`、`inbounds`、`endpoints` 等的完整配置。规则：只取 `outbounds`；按白名单保留 Omnia 支持的代理协议类型；selector、urltest、direct、block、dns 等策略组与特殊出站一律丢弃；`route`、`dns`、`inbounds`、`endpoints`、`experimental` 等整段忽略；wireguard 丢弃并计数。保留下来的节点解析进 IR，之后和其他来源走同一条管线。

**输出形态与现有快照的关系**：Node Snapshot 的顶层结构（`schema_version`、`updated_at`、`source`、`sources`、`outbounds`）、来源标记 `x_omnia_source_*` 和 tag 全局唯一等校验沿用现有代码，转换层只负责为每个订阅源产出干净的 outbounds 数组。现状里有一个漏洞：现有校验只要求 `type` 与 `tag` 非空，不检查节点类型，所以今天如果 sing-box 订阅里带着 selector、urltest、direct，它们会被当成节点写进快照。提取白名单正好堵上这一点。建议同时在快照校验里加一道节点类型检查作为双保险，这需要走影响分析。

**提取时的字段处理（已确认）**：sing-box 订阅只保留节点本身的详情，其余信息不要。(1) 去掉 `detour`。(2) 去掉所有 DNS 相关字段（`domain_resolver`、`domain_strategy`）：Omnia 不继承机场配置里的 DNS 引用关系，节点域名解析由 Omnia 统一管理，见第 7 节。(3) 去掉带环境相关性的拨号字段（`bind_interface`、`routing_mark`、`inet4_bind_address`、`inet6_bind_address` 等），它们来自别人的设备。(4) 无法识别的其余字段原样保留。(5) 去掉 `detour` 和 DNS 字段后，快照里的节点不再引用任何被丢弃的出站或 DNS 服务器，所以不会出现悬空引用。

**链式节点（已确认丢弃）**：sing-box JSON 里依赖 `detour` 的链式节点（典型是 ShadowTLS 加 ss）直接丢弃并计数。`detour` 指向的目标不存在时同样丢弃，状态里报告丢弃数量和原因，不静默留下不能用的节点。被别的节点用 `detour` 引用、只作为中转的前置节点，建议一并丢弃，否则它会作为一个独立节点混进节点列表（已确认）。为了让所有输入得到的节点格式一致、每个出站都能独立使用，建议 Clash 与 URI 里的 ShadowTLS 节点首期也不支持，同样丢弃并计数（已确认）。

**提取示例**：完整配置里有 selector“节点选择”、vless“香港01”、hysteria2“日本01”、urltest“自动选择”，以及 `route`、`dns`。提取后只剩两个真实节点：

```
vless      香港01  hk.example.com:443
hysteria2  日本01  jp.example.com:443
```

策略组与 `route`、`dns` 全部丢弃。每个出站另由现有代码加上 `x_omnia_source_*` 来源标记，并要满足现有快照校验。无论节点来自 sing-box JSON、Clash 还是 base64，最终快照里的节点格式一致，区别只在 Clash 与 base64 需要先转换。

**容错**：缺 server 或端口不在 1 到 65535 的节点在解析阶段丢弃并计数，避免一个坏节点让整份配置无法通过 `sing-box check`。

**字段映射**：集中在 sing-box 生产器一处，采用映射表驱动，并注意类型细节（数组字段不能写成字符串，数字数组不能写成字符串数组）。原版生产器默认把 TLS 的 `server_name` 取为节点的 server 域名，所以以后即使把 server 换成 IP，也要保留原域名作为 SNI。首期不生成带 `detour` 的链式节点（见上，ShadowTLS 不支持）。**wireguard 不做（已确认）**：新版 sing-box 里它属于 endpoints，而 Omnia 的快照只有 outbounds。输入里遇到 wireguard 节点会被丢弃并计数。不硬编码 sing-box 可选字段是否有效，最终交给设备上的 `sing-box check`，与 DEVELOPMENT.md 的契约一致。

**User-Agent**：每个订阅源可选 UA，提供常见客户端预设，也允许自定义。部分机场按 UA 决定返回 Clash 还是 base64，用错会拿到占位假节点。

## 5. 本地节点

订阅源增加"类型"：远程（URL）与本地。

- **粘贴导入**：粘贴一段节点文本（URI 列表、base64、Clash YAML、sing-box JSON 均可），走同一套嗅探与解析。
- **表单录入**：按协议动态字段逐条录入。首期建议覆盖 ss、vmess、vless、trojan、hysteria2、tuic、socks。
- 本地源没有 URL 与拉取步骤，"刷新"等于重新解析并重新套用操作符。
- 本地源与远程源共用同一套操作符、DNS 设置、来源标记和快照结构。

现有 `validate_url` 要求 URL 以 http 开头，订阅配置 schema 也较严格，需要按 "订阅源类型" 调整校验。这属于配置契约变更，要先做影响分析。

## 6. 操作符

操作符是每个订阅源上的一个有序列表，每项可单独禁用，按列表顺序执行。首期支持的类型如下，名称对应 Sub-Store 原版。

| 操作符 | 原版对应 | 说明 |
| --- | --- | --- |
| 正则过滤 / 反向正则过滤 | Regex Filter | 匹配节点名，保留或剔除 |
| 类型过滤 | Type Filter | 按协议保留或剔除 |
| 条件过滤 | Conditional Filter | 对节点任意字段做 IN、CONTAINS、EQUALS、EXISTS 判断，可用 AND、OR、NOT 组合，不写脚本就能按字段过滤。原版 README 没列，源码里有，已确认保留 |
| 正则重命名 / 正则删除 | Regex Rename / Delete | 查找替换节点名，或删除匹配片段 |
| 批量设置属性 | Quick Setting | udp、tfo、跳过证书验证等，取值为启用、禁用或保持原样 |
| 去重与重名处理 | Handle Duplicate | 两种动作：删除重复（可选按哪些字段判断，默认按名称），或重命名（追加序号，可配模板、连接符、前后位置） |
| 排序 / 正则排序 | Sort / Regex Sort | 按名称，或按一组关键字的优先顺序 |
| 国旗增删 | Flag | 给节点名加上或去掉国旗 emoji |
| 脚本过滤 / 脚本操作 | Script Filter / Operator | 见第 8 节 |

**注意一**：重命名会影响 Omnia 靠节点名识别地区与倍率的行为（如 `x1.5`），界面上要提示。

**注意二**：正则方言。ucode 使用 POSIX ERE，和 JavaScript 正则、Lua 模式都不同。文档里要写明支持范围，并用用例固化行为。

## 7. DNS：声明式方案

**背景**：Omnia 默认模板已使用 sing-box 1.12+ 的新 DNS 写法，并设置了 `route.default_domain_resolver`。sing-box 允许在 outbound 上用 `domain_resolver` 指定解析自身域名的 DNS 服务器 tag。

**设计**：

- **Omnia 统一管理所有节点的服务器域名解析**，不继承机场 sing-box 配置里的任何 DNS 引用。无论节点来自哪种输入，快照里的节点都不带 `domain_resolver`，生产器也不输出它，脚本改不了它。
- 每个订阅源可配置专用 DNS：协议类型（udp、https、tls、quic 等）、地址，以及该 DNS 自身域名的引导解析（如需要）。
- 订阅源配置了专用 DNS 时，该源的节点优先使用它；没配置时，使用 Omnia 默认解析策略，也就是模板里的 `route.default_domain_resolver`。
- **生成器负责**：给每个专用 DNS 分配 tag（带订阅源 id，避免和模板冲突）、加入 `dns.servers`、给该源的节点写入引用，并验证依赖关系：每个被引用的 tag 必须存在。验证不通过时生成失败并给出明确提示，**禁止输出悬空的 DNS 引用**。
- 后续可选：原版的“域名解析”操作符支持自定义 DNS，在刷新时把 server 换成 IP 并保留原域名，适合不想让路由器运行时解析的场景。首期不做。

**约束**：

- 这个 DNS 服务器不能绕行到节点，否则解析节点域名要先连节点，形成死循环。
- tag 必须真实存在，否则 `sing-box check` 失败，应在生成前自检并给出明确提示。
- 要求 sing-box 1.12 及以上，与 Omnia 目标版本一致。

这意味着"转换层只出 outbounds，其余不动"有一个例外：生成器需要多处理一类 DNS 条目。

## 8. 脚本能力

**形态**：参考原版的两种写法。整批模式：脚本收到节点数组（IR 对象）和上下文，返回数组，可过滤、改字段、增删节点。单节点模式：脚本只处理一个节点变量，由外层逐个节点调用，适合写简单修改。两种模式都支持传入参数。脚本语言默认按 ucode。原版的脚本是用 JavaScript 动态函数直接运行，没有沙箱，能访问网络请求、持久化存储和一组工具库。Omnia 不照搬这一点（见下）。

**运行方式与约束**：

- 在独立子进程中运行，设置超时与资源上限。
- 默认不提供网络访问；不提供落地检测、IP 归属查询、拉起内核测速、读 GeoIP 库等原版社区脚本常用的能力。
- 输入输出均为 JSON；输出必须通过 outbound 校验与 tag 唯一性检查，失败则保留旧快照并记录错误。
- 提供少量工具函数，如国旗转换、判断是否为 IP、按正则匹配。
- LuCI 提供“预览结果”，在不写入快照的情况下查看脚本和操作符的输出。

**安全定位**：LuCI 管理员在 OpenWrt 上本就等同 root，所以主要防的是脚本写错或粘贴来源不明的脚本，而不是提权。

**待确认**：脚本语言默认按 ucode 处理。jq 是另一种受限方案（纯函数、无副作用，但新增依赖）。

## 9. 快照契约变更

- `generator_input.uc` 目前要求 `source` 等于 `sub-store`。放宽为接受 `sub-store` 与新值（建议 `omnia`），旧快照仍可读取。
- 订阅源条目建议记录检测到的输入格式，便于排错。
- 订阅源类型字段（远程、本地）及操作符、DNS 配置进入订阅配置 schema。
- 以上都属于 DEVELOPMENT.md 中"不可变约束"相关的契约，实施前要完成影响分析并保持向后兼容。

## 10. 失败与回退

沿用现有行为：解析失败、校验失败、拉取失败都保留该源的旧节点；空结果拒绝；单源刷新不影响其他源。新增的失败阶段（嗅探、解析、操作符、脚本）要映射到现有的状态字段，让界面能看出是哪一步出错。

## 11. 测试策略

解析器、操作符、去重、生产器的字段映射都是纯函数，适合用表格式 fixtures 做回归：输入订阅样本，断言输出 outbounds。样本建议用你实际在用的机场订阅脱敏后的内容，按协议、格式变体和容错场景分类。

DEVELOPMENT.md 里说容器化 OpenWrt 测试不做门禁，因为它模拟不了 procd、TUN 与路由。纯函数测试不依赖这些，建议作为例外加入 CI。

**跨格式一致性**：同一个节点分别以 URI、Clash、sing-box JSON 三种写法给出，经过转换后得到的 outbound 应当一致（sing-box 输入里认不出的原样字段除外）。把它作为核心 fixtures：同一批节点准备三种输入，断言输出相同。

## 12. LuCI 界面

订阅页新增：订阅源类型选择、UA 选择、操作符配置、DNS 配置、脚本编辑器、预览按钮、本地节点导入与表单。同时清理页面中写着 Sub-Store 的文案。

## 13. 明确不做

Surge、Loon、QX、Egern、Shadowrocket、Surfboard 等输入格式；SSR、Snell、Juicity、wireguard（含 endpoints）；ShadowTLS 与链式节点；组合订阅；文件管理；Gist 同步；公开下载链接与 token；脚本里的网络请求、落地检测、内核测速。

## 14. 分阶段路线

1. **M1**：格式嗅探、URI 与 base64 解析成 IR、sing-box 生产器、残缺节点丢弃、tag 唯一化、`source` 字段放宽、自定义 UA、sing-box JSON 反向解析、fixtures。
2. **M2**：Clash YAML 受限解析、有序操作符列表（正则过滤、类型过滤、条件过滤、重命名、批量设置、去重、排序、国旗）、预览、订阅流量与到期展示。
3. **M3**：DNS 声明式方案（订阅源专用 DNS 配置、生成器分配 tag 并建立引用、依赖校验）。
4. **M4**：本地节点（粘贴与表单）、脚本（整批与单节点模式、参数、工具函数）。

## 15. 已确认的取舍

本节原来的待确认项已全部确认，没有遗留问题。

- 保留条件过滤（Conditional Filter）。
- 采用统一节点模型（IR），取代 v1 的“不设中间模型”。
- sing-box JSON 订阅也解析进 IR，不直通，保证所有来源输出一致的 outbounds JSON。
- 不做 wireguard。
- sing-box JSON 里依赖 `detour` 的 ShadowTLS 链式节点丢弃并计数；只作中转的前置节点一并丢弃。
- Clash 与 URI 里的 ShadowTLS 节点首期同样不支持，丢弃并计数，保证所有输入得到的节点都能独立使用。

同时确认：

- 脚本语言用 ucode。
- 纯函数测试作为 CI 例外。

## 16. 主要风险

- Clash YAML 的写法多样，受限解析器需要用真实机场样本持续补齐。
- 正则方言差异可能让从 Sub-Store 迁移过来的规则行为不一致。
- 订阅配置 schema 与快照契约变更需要兼容旧数据。
- sing-box 字段随版本变化，映射表需要跟着维护。
- 脚本出错时的可诊断性，需要靠预览与清晰的错误信息解决。
- 反向解析 sing-box JSON 时保留无法识别的字段，可能把不该带的字段带进来，需要用样本持续核对剥离清单。
- sing-box JSON 里依赖 `detour` 的链式节点去掉 `detour` 后无法使用，需要按上面的建议丢弃并计数。
