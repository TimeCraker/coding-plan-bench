---
id: CPB-PRD-001
title: Coding Plan Bench 可信测速与全端体验优化 PRD
kind: prd
version: 1
status: READY
baseline_sha: 00e9543977cd8b1262b60257af2a2b17352eafbf
related: S01-TRUSTED-BENCHMARK (docs/ai-delivery/stages/S01-trusted-benchmark.spec.md); S01-TRUSTED-BENCHMARK-TASKS (docs/ai-delivery/tasks/S01-trusted-benchmark.tasks.md)
handoff_ref: docs/ai-delivery/handoffs/S01-trusted-benchmark.md
observed_handoff_revision: 1
---

# Coding Plan Bench 可信测速与全端体验优化 PRD

## 1. 背景与问题

Coding Plan Bench 的产品价值不是“能发出一次模型请求”，而是让开发者在明确的执行链路和一致的测试条件下，得到可信、可解释、可复现的 TTFT、TPS 与总耗时数据。目前页面已经具备表单、结果卡、榜单、双主题、Worker/Node 入口和 Tauri 壳，但审计表明核心计量、隐私表达、代理边界、桌面端落地和工程门禁之间没有形成闭环。

当前最严重的问题不是视觉细节，而是产品承诺与实际行为冲突：默认 3 次取样直接把 API Key 发送到远端代理，但页面写“Key 不上传”；榜单混合浏览器直连、边缘代理和历史本机示例，却写“反映本机当前真实表现”；计量实现还会漏掉 CRLF SSE、把普通正文生成误报为思考时间，并在空流时返回负 TTFT 且标记成功。

本 PRD 的目标是从测量定义、传输信任边界和数据模型开始重建，再统一修正产品流程、文案、前端视觉、无障碍、桌面端和发布体系。

### 1.1 审计基线

- 仓库：`C:\Users\TimeCraker\Desktop\my-workspace\coding-plan-bench`
- 分支：`main`
- 基线 HEAD：`00e9543977cd8b1262b60257af2a2b17352eafbf`
- 规划前工作区：clean
- 已验证：`npm run build` 退出 0，但现有 `tsconfig.json` 未覆盖 `site/**` 与 `engine/**`，因此不能证明全仓 TypeScript 正确。
- 完整源码类型检查复现 5 个错误：未使用导入/函数、`prompt` 可空类型、失效的 `../../../bench/types` 引用、缺少 Vite `ImportMetaEnv` 类型。
- 本地 Tauri `cargo check --locked` 因缺少 MSVC `link.exe` 阻塞；这是本机环境门禁，不是源码通过证据。
- 本地模拟 SSE 复现：CRLF 事件解析数为 0；仅正文事件返回 `thinkingMs: 10`；空流返回 `ttft: -10`、`success: true`。
- 真实页面在 1280×720 与 375×812 检查；移动端删除按钮计算样式为 `opacity: 0`，图标 GitHub 链接无可访问名称，协议/指标切换无选中语义。
- 线上 Cloudflare Pages 页面可访问，页面仍展示与当前传输行为冲突的 Key/本机文案。

### 1.2 问题登记与根因

| ID | 严重度 | 领域 | 现象 | 根因 | 根治方向 |
|---|---|---|---|---|---|
| AUD-001 | P1 | 隐私/信任 | 默认 3 次取样必走远端代理，却声明“Key 不上传” | 传输策略由取样数隐式决定，UI 没有信任边界模型 | 显式选择执行位置；默认浏览器直连；代理必须用户知情同意并仅限受信上游 |
| AUD-002 | P1 | 安全/成本 | 公共代理接受任意 endpoint、samples、maxTokens，CORS 全开放 | 服务被设计成无约束通用转发器 | HTTPS + 受信 host/path allowlist、禁止重定向/私网目标、输入/体积/次数/超时上限、来源与边缘限流 |
| AUD-003 | P1 | 测量正确性 | CRLF SSE、尾部事件、多行 data 处理不符合 SSE 语义 | 解析器按 `\n\n` 与单行字符串切分 | 独立、增量、协议兼容的 SSE parser，并以分块/CRLF/EOF fixture 覆盖 |
| AUD-004 | P1 | 测量正确性 | 空流成功且 TTFT 为负；无正文/usage 也可入榜 | 成功仅取决于 HTTP 2xx，没有结果不变量 | 引入 `complete/partial/failed`，要求正文首 token、流完成与必需指标成立 |
| AUD-005 | P1 | 指标定义 | 普通正文被计为 thinking；TPS 用独立中位数拼接计算 | 缺少事件时间线与逐样本指标模型 | 区分 reasoning/text 首尾时间；逐样本算 TPS，再对 TPS 取中位数 |
| AUD-006 | P1 | 可比性 | `Reply exactly: OK` 几乎无法测吞吐；usage 缺失时用字符数/2伪估 token | 测试 profile 与排名契约缺失 | 版本化固定 profile；无 provider usage 时 TPS 为不可排名，不伪装精确 token |
| AUD-007 | P1 | 可比性 | 本机、浏览器、Worker 与历史示例混排，仍标“最优” | LeaderboardEntry 没有 transport/profile/measurement version | 数据 schema 版本化、迁移、按同条件分组，示例与真实记录分区 |
| AUD-008 | P1 | 桌面端 | Tauri 壳没有本地请求适配器，生产默认 `/api` 不存在 | 计划中的 Node sidecar 从未实现，前端未按运行时选 transport | 使用 Tauri HTTP 插件作为 `fetchImpl`，复用 TS 引擎并用真实安装包 smoke 验证 |
| AUD-009 | P1 | 部署 | README 以 Cloudflare Pages 为主，CI 却部署 GitHub Pages；默认 `/api` 也无仓库内路由 | 部署拓扑和环境变量没有单一来源 | 选定 Cloudflare Pages + Worker 为主拓扑，CI 显式注入 API 与 origin 配置 |
| AUD-010 | P2 | API 契约 | OpenAI placeholder 含 `/v1`，实现再次追加 `/v1/chat/completions` | “基础地址”定义模糊且拼接散落两处 | 改为完整 Request URL，统一构造一次并消除重复实现 |
| AUD-011 | P2 | 错误处理 | 代理把上游响应前 200 字符返回给客户端；前端回退失败时丢失代理错误 | 没有稳定错误码、脱敏和双链路诊断模型 | 结构化错误码、面向用户文案、内部安全摘要，不回传上游正文/凭证 |
| AUD-012 | P2 | 多样本 | 任一成功即整体 success，UI仍写请求次数的“中位数” | `successCount` 未进入前端契约 | 完整/部分/失败三态；部分结果不默认排名并明确成功样本数 |
| AUD-013 | P2 | 交互 | 无取消、无样本进度、90 秒×多次时只能等待 | API 只返回最终聚合且没暴露 AbortSignal | 浏览器/本地逐样本执行、进度状态机和取消；代理受硬上限约束 |
| AUD-014 | P2 | 文案 | “任意模型”“终极判据”“本机真实表现”等结论超过证据 | 营销文案未绑定能力与方法学 | 建立能力限定、数据来源标签、指标解释和方法学入口 |
| AUD-015 | P2 | 前端信息架构 | 视觉上是大 Hero landing page，核心工具操作落到首屏下方 | 设计系统写“dashboard”，实现却按营销页展开 | 压缩 Hero，把模式/安全说明与表单前置，结果与榜单围绕决策组织 |
| AUD-016 | P2 | 移动端 | 删除操作仅 hover 可见，长模型信息拥挤，控件选中态不明确 | 桌面 hover 模型直接复用到触屏，缺少响应式交互契约 | 移动端常显操作、44px 触控区、分层摘要与可横向容纳的指标切换 |
| AUD-017 | P2 | 无障碍 | GitHub 图标链接无名称；tabs 无 role/selected；错误/loading 无 live region | 只实现视觉状态，未实现语义状态 | 完整 accessible name、tablist/aria-selected、status/alert、键盘与焦点测试 |
| AUD-018 | P2 | 工程质量 | `npm run build` 漏检核心前端目录，且没有 lint/unit/e2e | tsconfig include 仍指向旧 `bench/`/`src/` 结构 | 统一全仓 tsconfig、质量 scripts、Vitest/Playwright 与 CI 必跑门禁 |
| AUD-019 | P2 | 遗留资产 | `fetchResults.ts` 指向不存在的 `bench/types`，`results.json` 与实际 UI 数据重复 | v1 静态看板与 v2 自测工具并存未收口 | 删除死链路；示例数据改为带 provenance 的单一 fixture |
| AUD-020 | P2 | 安全基线 | Tauri CSP 为 null，站点未见仓库内安全 header 配置 | 动态样式和部署安全未纳入 Definition of Done | 移除运行时 style 注入，设置可工作的 CSP/headers 并做自动验证 |
| AUD-021 | P3 | 视觉/性能 | 字体声明未实际加载，简单工具初始 JS gzip 约 109KB，装饰动画持续运行 | 设计 token、依赖和实现不一致 | 选择本地字体/系统字体单一策略，按 reduced-motion 停止 JS 动画，建立 bundle budget |
| AUD-022 | P3 | 文档维护 | PLAN、PLAN-v2、README 与真实架构互相冲突 | 计划文档未在架构变更后归档或更新 | README 成为使用事实源，旧计划标注 superseded，并由 CI 校验关键命令 |

## 2. 目标用户和核心场景

### 2.1 目标用户

1. 需要在多个 OpenAI/Anthropic 兼容服务之间比较交互速度的开发者。
2. 对 API Key 去向敏感，希望选择浏览器直连或本地桌面执行的个人用户。
3. 维护公开实例、需要控制 Worker 风险和成本的项目维护者。
4. 需要复核测试条件、判断数据是否可横向比较的技术评估者。

### 2.2 核心场景

1. 用户选择协议与执行位置，输入完整请求 URL、模型和 Key，运行版本化测速 profile。
2. 用户在运行前明确知道 Key 会发送给模型厂商、是否会经过项目代理，以及哪些数据会本地保存。
3. 用户查看逐样本状态、取消长任务，并区分完整、部分失败和失败结果。
4. 用户只在相同 profile、measurement version 与 transport scope 内比较排名。
5. 用户安装 Windows 本地版后，无需依赖远端 `/api` 即可完成多样本测速。
6. 维护者通过 CI 验证类型、单测、集成、响应式、无障碍、安全边界、站点构建与 Windows 安装包。

## 3. 目标及成功指标

| 目标 | 指标 | 目标值/验证方式 |
|---|---|---|
| 测量可信 | 协议与计量 fixture 覆盖 | CRLF/LF、任意 chunk、EOF、多行 data、reasoning/text、usage 缺失、空流、partial samples 全通过 |
| 隐私透明 | 未经同意的代理发送 | 0；默认多样本也不得因 samples 自动切换代理 |
| 代理安全 | 非 allowlist、HTTP、私网/IP、重定向、超限请求 | 全部在发起上游请求前拒绝；稳定错误码 |
| 数据可比 | 跨 transport/profile 混排 | 默认 0；UI 必须分组或要求显式切换比较范围 |
| 桌面可用 | Windows 安装包离线于项目代理完成 1/3/5 次样本 | CI 构建 + 实机 smoke 证据通过 |
| 工程可验证 | `typecheck/lint/unit/integration/e2e/build` | CI 全部退出 0，且验证后无未声明 tracked 变更 |
| 可访问性 | 自动扫描与键盘主流程 | 0 个 critical/serious；所有图标操作可命名、可聚焦、状态可读 |
| 响应式 | 375/768/1024/1440 | 无页面级横向滚动；触控操作 ≥44×44 CSS px；关键信息不靠 hover |
| 性能 | 初始站点 JS | gzip ≤100KB；若超过必须有 bundle 报告和显式批准 |
| 文案真实性 | 隐私、来源、方法学声明 | 每条能映射到实现/配置/测试，不再使用无条件“任意”“不上传”“本机真实” |

## 4. 范围

### 4.1 本阶段范围

- 重建测速指标、事件时间线、SSE 解析、样本聚合和失败语义。
- 将 endpoint 改为“完整 Request URL”，统一协议请求构造。
- 引入浏览器直连、可信代理、Tauri 本地三种显式 transport。
- 限制公共代理上游、输入、请求体、次数、token、超时、重定向、CORS 与错误输出。
- 版本化 leaderboard 数据，区分来源、profile、token source、样本完整性和示例数据。
- 重构页面信息架构、关键文案、运行进度、取消、错误、结果和榜单。
- 完成亮/暗主题、375–1440 响应式、键盘、屏幕阅读器和 reduced-motion 改造。
- 修复 TypeScript 覆盖，加入 lint、unit、integration、e2e、a11y、安全与 bundle 门禁。
- 让 Windows Tauri 本地版使用本机 HTTP transport，补 CSP、CI、部署和 README。

### 4.2 后续阶段候选

- 历史趋势、云同步、账号体系、团队榜单。
- 自定义 benchmark profile 编辑器和可导入测试集。
- macOS/Linux 安装包。
- 服务端持久化、公开共享链接和跨用户聚合。

## 5. 非目标

- 不承诺不同模型输出质量相同，也不把 Total 定义为单一“终极判据”。
- 不开放任意 URL 的公共代理；任意兼容服务应使用浏览器直连或本地 App。
- 不存储 API Key，不引入账号、数据库或服务端 leaderboard。
- 不用字符数估算冒充精确 token；usage 缺失时不提供可排名 TPS。
- 不在本阶段支持用户自定义 headers、任意请求 body 或非 OpenAI/Anthropic 兼容协议。
- 不在本阶段发布 macOS/Linux 包。

## 6. 功能需求

### FR-001 显式执行位置

系统必须显示并持久化本次选择的执行位置：`browser-direct`、`trusted-proxy` 或 `tauri-local`。改变 samples 不得改变 transport。浏览器直连失败后不得静默转发 Key；只有受信上游且用户当次明确同意时才能使用代理。

### FR-002 规范化请求契约

用户输入的是完整 HTTPS Request URL。系统按选定协议只构造 body 与 headers，不再拼接 `/v1/messages` 或 `/v1/chat/completions`。URL 必须拒绝凭证、fragment、非 HTTPS 和不允许的目标。

### FR-003 版本化测速 profile

默认 profile 必须具有稳定 ID、版本、prompt、参数、预期输出范围与 hash。每条结果记录 profile version、measurement version、transport 和运行环境标签。

### FR-004 正确采集指标

TTFT 定义为请求开始到第一个非空可见正文 delta；thinking duration 仅在出现 reasoning/thinking delta 且随后出现正文时存在；TPS 使用 provider usage 的 output tokens 除以正文生成区间；Total 为请求开始到流完成。缺少必需事件时返回结构化失败或不可用指标。

### FR-005 多样本与部分失败

每个样本独立计算指标，再分别取成功样本的中位数。只有成功样本数等于请求样本数时结果为 `complete`；部分成功为 `partial`，默认不进入排名；0 成功为 `failed`。UI 显示 `成功/请求` 数量。

### FR-006 进度和取消

浏览器与本地 transport 必须显示当前样本、阶段和耗时，并允许取消。取消后停止后续样本，结果状态为 `cancelled`，不得入榜。

### FR-007 安全代理

可信代理只允许部署配置中的 HTTPS host + path prefix，禁止 IP literal、localhost/private target、URL credentials、非标准端口、重定向和超限请求。错误响应不得包含上游 body、Key 或完整内部异常。

### FR-008 可比较榜单

榜单默认只比较相同 profile version、measurement version、transport scope 且状态 complete 的真实结果。示例数据独立展示并明确来源；用户可以筛选 transport/metric，但不能把不兼容结果标为同一排名“最优”。

### FR-009 本地桌面执行

Windows Tauri App 必须通过本机 native HTTP transport 复用 `engine/**`，生产环境不依赖 `/api`。Key 不离开用户设备与目标厂商之间的请求链路。

### FR-010 真实清晰的页面

页面首屏必须优先呈现工具用途、执行位置/Key 去向和表单。文案必须限定“双协议兼容服务”，解释网络位置和测试 profile 对结果的影响，并提供方法学入口。

### FR-011 响应式与无障碍交互

所有主流程在 375/768/1024/1440 宽度可用；移动端操作不依赖 hover。协议与指标切换具有 tab/selected 语义；loading、progress、error 和 result 有 live region；图标链接/按钮有可访问名称。

### FR-012 可验证发布

仓库必须提供统一脚本和 CI，覆盖 typecheck、lint、unit、integration、e2e、a11y/security、build、bundle budget 与 Windows package。README、部署 workflow、环境变量和线上拓扑必须一致。

## 7. 非功能需求

### NFR-001 安全与隐私

- Key 仅存在于当前运行内存和发往用户选择目标所需的请求中，不进入 localStorage、日志、URL、错误文本、analytics 或构建产物。
- 公共代理默认拒绝未知目标；CORS 只允许配置的站点 origin。
- 站点和 Tauri 启用最小可工作的 CSP；站点提供 HSTS、nosniff、referrer policy、permissions policy 和 frame 防护。

### NFR-002 正确性与可复现性

- 所有指标定义、rounding、null 语义和 aggregation 必须由纯函数与 fixture 测试固定。
- `success` 不得与 HTTP 2xx 等价；不得出现负耗时、NaN、Infinity 或无正文 complete。
- 每条结果能追溯到 profile、transport、版本、样本和 token source。

### NFR-003 性能

- 首屏初始 JS gzip ≤100KB；动态测速引擎可独立 chunk。
- 无必要的无限动画；`prefers-reduced-motion` 时停止 JS 循环动画和 count-up。
- 页面无 layout shift 导致的关键控件跳动。

### NFR-004 可用性

- 表单错误就地展示且保留非敏感输入；Key 默认不持久化。
- 所有错误有稳定 code、用户可执行建议和可复制的非敏感诊断摘要。
- 长任务可取消，离开页面时终止正在运行的浏览器请求。

### NFR-005 可维护性

- 单一根 `tsconfig` 覆盖 `engine/server/src/site`，路径别名与 Vite 一致。
- 请求构造、指标计算、示例数据和错误映射各有一个事实源。
- 旧 PLAN 文件标记 superseded，不继续作为当前架构依据。

## 8. 验收条件

### AC-001 SSE 与计量正确

给定 LF/CRLF、任意 chunk 边界、多行 data、EOF 尾事件、Anthropic thinking/text、OpenAI reasoning/content、usage 缺失和空流 fixture，解析器不丢合法事件；TTFT/thinking/TPS/Total 符合本 PRD 定义；无正文、负值或非有限值不能成为 complete。

### AC-002 多样本聚合正确

给定 1/3/5 个含成功、失败、取消的样本，系统逐样本计算并对每个指标独立取中位数；完整、部分、失败、取消状态和 `successCount/requestedSamples` 正确；partial/cancelled 默认不排名。

### AC-003 Key 路径真实可控

默认浏览器运行 3/5 次仍使用 browser-direct；直连失败不自动代理。选择 trusted-proxy 前显示 Key 会经过项目服务并要求当次确认；Tauri 使用 tauri-local。结果记录和页面说明与实际 transport 一致。

### AC-004 代理拒绝危险输入

HTTP URL、credentials、fragment、IP literal、localhost/private host、未知 host/path、重定向、samples>5、maxTokens 超界、body 超界和非 allowlist Origin 全部在可验证边界被拒绝；未发起上游请求；响应不泄露 Key 或上游 body。

### AC-005 URL 与协议兼容

OpenAI/Anthropic 的完整 Request URL 被原样请求一次，不重复追加 path；headers/body 符合协议 fixture；不支持的协议或 URL 给出稳定错误码。

### AC-006 榜单可比较且可迁移

旧 `cpb:leaderboard` 数据经一次性迁移保留为 legacy/unranked；新数据包含 schema、profile、measurement、transport、token source 与样本状态。示例数据不与真实结果争夺“最优”，筛选与排序只处理兼容 complete 数据。

### AC-007 Windows 本地版闭环

从 CI 产出的 Windows 安装包启动后，可在不访问项目 Worker/Node `/api` 的前提下完成 1/3/5 次测试、取消和查看结果；网络记录只包含应用资源、目标 provider 与必要的更新/系统流量；Key 不出现在日志或 localStorage。

### AC-008 文案与功能一致

Hero、安全提示、transport 说明、表单、结果、榜单、footer、README 和 release 文案不再无条件声称“任意模型”“Key 不上传”“本机真实表现”或“Total 是终极判据”；每种 transport 清楚说明 Key 去向和网络位置。

### AC-009 响应式和可访问性

在 375/768/1024/1440 无页面级横向滚动；移动端删除/详情操作可见且点击区 ≥44px；键盘可完成协议选择、表单、运行、取消、指标切换和删除；自动 a11y 扫描无 critical/serious；状态使用正确 live semantics。

### AC-010 视觉系统一致

页面从“大 Hero + 工具下沉”改为紧凑专业测速工作台；信息层级依次为信任/模式、输入、进度/结果、可比榜单、方法学；亮暗主题 token 一致；reduced-motion 停止循环动画；初始 JS gzip 满足预算。

### AC-011 工程门禁可信

`npm run typecheck` 覆盖全部 TS/TSX；`lint/test:unit/test:integration/test:e2e/build/check:bundle` 都真实存在并通过；CI 对 PR 与 main 执行；验证后 `git status --short` 没有未声明 tracked/untracked 产物。

### AC-012 部署与文档一致

Cloudflare Pages + Worker 是唯一主拓扑，workflow 显式配置 API base、allowed origins/upstreams 和 security headers；`/api/health` 与站点 smoke 通过；README 的安装、开发、隐私、限制和发布命令可逐条执行。

## 9. 约束、已定决策、风险与依赖

### 9.1 已定决策

- 公共代理不再支持任意 endpoint；“任意兼容服务”通过 browser-direct 或 tauri-local 保留。
- endpoint 字段改为完整 Request URL，避免供应商 path 差异和双重 `/v1`。
- usage 缺失时 TPS 为 `null/unranked`，不再使用字符数估算冒充 token。
- Cloudflare Pages + Worker 为主部署；GitHub Pages workflow 不再作为主站发布事实源。
- Windows 为本阶段唯一桌面发布平台；macOS/Linux 后置。
- 示例数据保留教育价值，但与真实榜单分区并携带 provenance。

### 9.2 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 厂商 SSE 变体超出 fixture | 某供应商不能测 | 协议 fixture + 安全保留未知事件 + 可新增 adapter，不在通用 parser 写厂商 hack |
| provider usage 不提供 | TPS 无法排名 | 明确显示“provider 未返回 token usage”，仍可展示 TTFT/Total |
| Tauri HTTP 插件权限/CSP配置复杂 | 本地版门禁延迟 | 先完成 adapter 单测和 CI build，实机 smoke 独立为外部门禁 |
| Cloudflare rate-limit 配置需要账号权限 | 公开服务仍可能被滥用 | 代码内硬限额与 allowlist 先落地；发布前由维护者完成边缘规则证据 |
| localStorage schema 迁移失败 | 用户历史丢失 | 原值备份、幂等迁移、损坏数据隔离与 fixture 回归 |
| 视觉重构扩大回归面 | 核心测速受影响 | 先冻结 domain/transport，再改 UI；E2E 以状态机和可访问语义驱动 |

### 9.3 外部依赖与 owner

- Windows MSVC/签名/安装包运行环境：repo maintainer；本机当前缺 `link.exe`，由 GitHub Actions Windows runner 和一台真实 Windows 机器提供证据。
- Cloudflare Pages/Worker secrets、allowed origins/upstreams、边缘 rate limiting：repo maintainer / Cloudflare account owner。
- 真实 provider API Key 与额度：用户/证据 owner；自动测试不得使用 mock 冒充真实链路验收。

## 10. 阶段划分和需求追踪

### 10.1 阶段

| Stage | 内容 | 状态 |
|---|---|---|
| S01 | 可信计量、安全 transport、数据模型、产品/视觉/无障碍、Tauri、CI 与文档一体化重构 | READY |
| S02 | 趋势、可导出报告、自定义 profile、跨平台桌面包 | 候选，N/A 于本轮 |

### 10.2 追踪表

| 需求 | 验收条件 | Stage | Task |
|---|---|---|---|
| FR-001 | AC-003 | S01 | T-005, T-006, T-007 |
| FR-002 | AC-005 | S01 | T-002, T-005 |
| FR-003 | AC-001, AC-002, AC-006 | S01 | T-002, T-004, T-008 |
| FR-004 | AC-001 | S01 | T-003, T-004 |
| FR-005 | AC-002 | S01 | T-004, T-007, T-008 |
| FR-006 | AC-002, AC-009 | S01 | T-006, T-007, T-009 |
| FR-007 | AC-004 | S01 | T-005, T-010 |
| FR-008 | AC-006 | S01 | T-008 |
| FR-009 | AC-007 | S01 | T-006, T-011, T-012 |
| FR-010 | AC-008, AC-010 | S01 | T-007, T-009, T-010 |
| FR-011 | AC-009, AC-010 | S01 | T-009 |
| FR-012 | AC-011, AC-012 | S01 | T-001, T-010, T-011, T-012 |
| NFR-001 | AC-003, AC-004, AC-007, AC-012 | S01 | T-005, T-006, T-010, T-012 |
| NFR-002 | AC-001, AC-002, AC-005, AC-006 | S01 | T-002, T-003, T-004, T-008 |
| NFR-003 | AC-009, AC-010, AC-011 | S01 | T-009, T-011 |
| NFR-004 | AC-003, AC-008, AC-009 | S01 | T-006, T-007, T-009 |
| NFR-005 | AC-011, AC-012 | S01 | T-001, T-010, T-011 |
