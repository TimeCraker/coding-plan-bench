---
id: S01-TRUSTED-BENCHMARK
title: S01 可信测速、受控传输与全端体验重构
kind: stage-spec
version: 1
status: READY
baseline_sha: 00e9543977cd8b1262b60257af2a2b17352eafbf
related: CPB-PRD-001 (docs/ai-delivery/prd/trusted-benchmark.prd.md); S01-TRUSTED-BENCHMARK-TASKS (docs/ai-delivery/tasks/S01-trusted-benchmark.tasks.md)
handoff_ref: docs/ai-delivery/handoffs/S01-trusted-benchmark.md
observed_handoff_revision: 1
---

# S01 可信测速、受控传输与全端体验重构

## 1. Stage 目标、关联需求与非目标

### 1.1 目标

在不引入账号或服务端存储的前提下，把 Coding Plan Bench 从“能请求并展示几个数字”的原型重构为可信测速工具：指标定义可复现、Key 路径由用户显式选择、公共代理不可作为任意转发器、榜单只比较兼容数据、Windows 本地版不依赖远端代理、页面文案与真实行为一致，并建立覆盖核心代码与发布面的自动质量门。

### 1.2 关联

- 功能需求：FR-001–FR-012
- 非功能需求：NFR-001–NFR-005
- 验收条件：AC-001–AC-012

### 1.3 非目标

- 账号、云数据库、共享榜单、多人协作。
- 自定义 headers/body、任意协议或任意 URL 公共代理。
- 输出质量评估与“综合最佳模型”评分。
- macOS/Linux 安装包、自动更新和代码签名采购。
- 为旧 `PLAN.md`/`PLAN-v2.md` 中未实现的历史趋势功能补实现。

## 2. 当前代码事实

### 2.1 架构与构建

- `engine/bench.ts` 同时负责请求构造、事件解释、计时、token 估算和聚合，浏览器/Worker/Node 复用。
- `engine/parse-sse.ts::iterSSEEvents` 仅搜索 `\n\n`，注释声称兼容 `\r\n\r\n`，本地 fixture 实测 CRLF 事件数为 0。
- `server/index.ts` 对 `/api/*` 使用无条件 `cors()`；`POST /api/bench` 只校验四个 truthy 字段，没有 URL、body、samples、maxTokens、origin、redirect 或上游 allowlist 约束。
- `site/src/lib/api.ts::runBench` 在 `samples > 1` 时直接使用 `benchProxy`；表单默认 samples=3，因此默认路径不是浏览器直连。
- `site/src/lib/api.ts` 与 `engine/bench.ts` 各自存在请求 body/path 构造逻辑；其中未使用的 `buildDirectBody` 会被完整类型检查报错。
- `tsconfig.json` include 为 `src` 和已不存在的 `bench`，不覆盖 `engine/server/site`。`npm run build` 虽退出 0，但完整源码检查发现 5 个 TypeScript 错误。
- 仓库没有 `test`、`lint`、`typecheck`、`e2e` 或 bundle budget script。

### 2.2 计量行为

- `handleAnthropicEvent`/`handleOpenAIEvent` 把第一个 thinking/reasoning delta 当 TTFT；与“首 token/用户体感正文”文案未形成严格定义。
- 每个 text delta 都更新 `thinkingEnd`，所以仅正文流也会得到正 `thinkingMs`；本地 fixture 返回 10ms。
- 空 2xx 流会返回 `success: true` 且 `ttft = 0 - t0`；本地 fixture 返回 -10ms。
- usage 缺失时按 `text.length / 2` 估 token；中文、英文、代码差异使其不能作为可比较 TPS。
- `benchMedian` 分别取 TTFT、Total、outputTokens 中位数后再计算 TPS，可能拼出不存在的样本；失败样本只要有 1 个成功就返回可成功展示的数据。
- 默认 prompt 为 `Reply exactly: OK`，不足以稳定测量吞吐。

### 2.3 产品、文案与数据

- `SecurityBanner.tsx` 声明“API Key … 不存储、不上传”，与默认代理路径冲突。
- `App.tsx` footer 声明“反映本机当前真实表现”，但 Worker 计时包含 Worker 到 provider 的网络位置。
- `README.md` 声明本地 App Key 全程在本机；实际 `src-tauri/src/lib.rs` 未提供 HTTP 命令/sidecar，生产前端的 `/api` 没有本地服务。
- `LeaderboardEntry` 没有 transport、profile、measurement version、token source、样本状态或环境字段；内置示例和用户数据混排并获得“最优”。
- `site/public/results.json` 与 `site/src/lib/storage.ts` 都保存示例事实；`site/src/lib/fetchResults.ts` 已失效且未被实际使用。
- `.github/workflows/deploy-site.yml` 部署 GitHub Pages，README 主站却是 Cloudflare Pages；workflow 未注入 Worker API base。

### 2.4 视觉与无障碍

- 页面设计系统定位“developer dashboard”，真实首页却把 4xl/6xl Hero 放在表单前，工具首要任务下沉。
- 375×812 检查时榜单删除按钮为 `opacity: 0` 且仍接收 pointer，触屏用户没有可见提示。
- GitHub 图标链接没有 accessible name；theme 只有 title；协议和指标按钮没有 `tablist/tab/aria-selected` 或等价 pressed 语义。
- loading、progress、error、success 没有 `role=status/alert` 或 `aria-live`。
- `BenchForm.tsx` 注入运行时 `<style>`，妨碍严格 CSP；Tauri CSP 当前为 null。
- 固定背景 Framer Motion 循环没有根据 `useReducedMotion` 停止；CSS 极短动画并不能保证 JS 动画不继续调度。

## 3. 方案概览与控制流

### 3.1 模块边界

```text
BenchmarkProfile + Exact Request URL
              │
              ▼
      engine/request.ts          只构造协议 headers/body
              │
              ▼
    Transport.fetch(request)     browser-direct | tauri-local | trusted-proxy
              │
              ▼
      engine/parse-sse.ts        标准事件帧/分块解析
              │
              ▼
     protocol adapter events     reasoning | text | usage | finish | error
              │
              ▼
    engine/measurement.ts        单样本时间线、状态、不变量
              │
              ▼
    engine/aggregate.ts          独立指标中位数 + complete/partial/failed
              │
              ▼
   Result + provenance schema    UI、localStorage migration、comparable leaderboard
```

### 3.2 运行流程

1. UI 收集协议、完整 Request URL、model、Key、samples、transport 和 profile。
2. UI 在运行前展示 transport 的 Key 路径；trusted-proxy 需要当次确认且目标必须在前端可见 allowlist 内。
3. `runBenchmark` 以同一 transport 串行运行每个样本，传入共享 AbortSignal 与 progress callback。
4. 每个样本经统一 `buildProtocolRequest` 和 SSE adapter 生成 typed events，再由 measurement reducer 产生结果。
5. aggregate 产生 `complete | partial | failed | cancelled`；UI 仅将 complete 且有可排名 metric 的结果写入默认比较视图。
6. storage 写 schema v2；首次读取时把旧 v1 记录迁移为 `legacy/unranked`，保留原始数值，不伪造 transport/profile。
7. browser-direct 从浏览器请求 provider；tauri-local 使用 Tauri HTTP 插件；trusted-proxy 调 `/api/bench`，由 server 再次做独立 allowlist 校验。

### 3.3 数据对象

```ts
type TransportKind = "browser-direct" | "trusted-proxy" | "tauri-local";
type RunStatus = "complete" | "partial" | "failed" | "cancelled";
type TokenSource = "provider" | "unavailable";

interface BenchmarkProfile {
  id: string;
  version: number;
  prompt: string;
  promptSha256: string;
  maxTokens: number;
  temperature: number;
}

interface SampleResult {
  status: "complete" | "failed" | "cancelled";
  ttftMs: number | null;
  thinkingMs: number | null;
  generationMs: number | null;
  totalMs: number;
  outputTokens: number | null;
  inputTokens: number | null;
  tps: number | null;
  tokenSource: TokenSource;
  error?: { code: string; safeMessage: string };
}

interface BenchmarkRunResult {
  schemaVersion: 2;
  measurementVersion: 1;
  profile: { id: string; version: number; promptSha256: string };
  transport: TransportKind;
  status: RunStatus;
  requestedSamples: 1 | 3 | 5;
  successCount: number;
  aggregate: Omit<SampleResult, "status" | "error">;
  samples: SampleResult[];
}
```

`LeaderboardEntryV2` 必须组合上面的 provenance、用户 label、protocol、request host、model 与 ranAt。不得保存 Key、完整 query 或 URL credentials；保存前把 Request URL 规范化为 origin + pathname。

## 4. 实现契约

### 4.1 UI 状态与交互

状态机固定为：

```text
idle → validating → consent-required → running → complete | partial | failed | cancelled
```

- transport 是显式 segmented control/fieldset；在 Tauri 中默认 `tauri-local` 且不能选不存在的远端 fallback。
- 浏览器默认 `browser-direct`。CORS/网络失败后显示选择：检查 URL、下载本地版、或（仅 allowlist 目标）确认使用 trusted-proxy。不得自动发送。
- trusted-proxy 确认文案必须包含：Key 会经项目 Worker 内存转发、不会写入应用存储、服务运营方/平台仍属于传输链路。
- 表单 label 为“Request URL（完整请求地址）”，协议切换时给完整示例；校验错误显示在字段下并通过 `aria-describedby` 关联。
- running 显示“样本 x/y、当前阶段、已用时”与取消按钮；离开组件时 abort。
- 结果卡显示 transport、profile、完整性、`successCount/requestedSamples`、token source。TPS 为 null 时显示“上游未返回 usage，不参与 TPS 排名”。
- 榜单默认隐藏 legacy/partial/demo 于正式排名；提供清楚的分区或筛选，不用一个“最优”跨条件比较。
- 清空/删除使用稳定对话或 undo toast；不能使用仅 3 秒文字切换且无 live 反馈的隐式确认。
- 375px：表单 header 纵向/换行，所有操作常显，metric controls 等宽或可访问滚动，触控区至少 44px。
- 使用 `prefers-reduced-motion`/Framer `useReducedMotion`；reduced 时无背景循环、数字 count-up 或 layout spring。

### 4.2 API 输入、输出、状态码与幂等性

`POST /api/bench` 请求：

```json
{
  "requestUrl": "https://approved.example/v1/messages",
  "apiKey": "runtime-only",
  "model": "model-id",
  "protocol": "anthropic",
  "profileId": "cpb-standard",
  "profileVersion": 1,
  "samples": 3
}
```

约束：

- Content-Type 必须为 JSON；body ≤16 KiB。
- `requestUrl` ≤2048 chars，HTTPS，无 credentials/fragment，标准 443 端口，host+path 匹配服务端 allowlist。
- `apiKey` 1–512 chars；`model` 1–128 chars；protocol 为枚举。
- profile 只能引用服务端内置、版本匹配的 profile；客户端不通过代理提交任意 prompt/maxTokens。
- samples 仅 1/3/5；单请求总墙钟上限为 profile timeout × samples，且服务端硬 cap。
- 上游 fetch `redirect: "manual"`；3xx 作为 `UPSTREAM_REDIRECT_REJECTED`。

响应：

- 200：请求被合法执行，body 为 `BenchmarkRunResult`；其中可为 complete/partial/failed，但结构有效。
- 400 `INVALID_REQUEST`：字段/JSON/profile 错误。
- 403 `ORIGIN_NOT_ALLOWED | UPSTREAM_NOT_ALLOWED`。
- 408/504 `BENCH_TIMEOUT`。
- 413 `BODY_TOO_LARGE`。
- 429 `RATE_LIMITED`。
- 502 `UPSTREAM_FAILED`，仅安全摘要，不含上游 body/header/URL query。

该 API 是非幂等的计费操作；不得自动重试。客户端重试必须由用户再次发起。

### 4.3 数据模型、迁移与兼容性

- localStorage key 升级为 `cpb:leaderboard:v2`；旧 `cpb:leaderboard` 只读迁移一次。
- 迁移前把原始字符串保存到 `cpb:leaderboard:v1-backup`；迁移幂等。
- v1 记录标记 `legacy: true`、`rankable: false`、transport/profile/tokenSource 为 unknown/unavailable，不推断。
- 损坏 JSON 不覆盖原值；隔离为 recovery 状态并向用户提供“重置本地数据”。
- 示例 fixture 只有公开 metrics 与 provenance，不包含 envVar；ranAt、profile、sourceLabel 和 `demo: true` 明确。
- N/A：无服务端数据库、迁移脚本、事务或备份恢复；本阶段所有持久数据仅在浏览器 localStorage。

### 4.4 身份、权限、安全和隐私

- N/A：无用户身份和角色授权。
- Worker CORS 使用 `CORS_ALLOWED_ORIGINS` 精确列表；无 Origin 的 curl/健康检查规则显式定义，不用 `*`。
- `ALLOWED_UPSTREAMS` 使用结构化 host+path prefix 配置；host 比较基于解析后的 ASCII hostname，禁止 suffix 欺骗。
- 拒绝 IP literal、`localhost`、`.local`、credentials、fragment、非 443 端口；禁止 redirect。Node 部署额外做 DNS 解析并拒绝 private/link-local/loopback 结果，防 DNS rebinding 的每次连接校验在实现说明中记录。
- 不记录 request body、Authorization/x-api-key、完整 query 或上游 error body。日志仅含 request id、safe host id、profile、samples、耗时、status/error code。
- 站点 `_headers` 和 Tauri CSP 至少设置：default-src self、object-src none、base-uri none、frame-ancestors none；connect-src 按浏览器直连能力使用 HTTPS 并在文档披露。运行时 `<style>` 移入静态 CSS。
- Key input 使用 password、`autocomplete="off"`、不进入 React dev logging、error、URL 或 storage。

### 4.5 错误、超时、重试和降级

- 错误类型固定：validation、consent、cors/network、auth、rate-limit、timeout、protocol/parse、empty-output、usage-unavailable、cancelled、proxy-policy、unknown。
- auth 错误只显示“凭证被上游拒绝”，不回显上游 body。
- parse/empty-output 是 failed，不允许以 0/负指标进入聚合。
- 部分样本失败不会自动重试；用户可显式重跑。
- browser-direct 的 CORS 失败只提供选项，不自动降级。
- trusted-proxy 不追随 redirect，不跨 host 重试。

### 4.6 日志、指标和可观测性

- 客户端提供非敏感诊断对象：measurement/profile version、transport、safe hostname、sample index、error code、timestamp。
- server 生成 request id 并返回响应 header；日志禁止敏感字段。
- `/api/health` 只返回版本、measurement version 与 ready，不探测 provider、不泄露 allowlist。
- CI 保存 junit/Playwright/bundle/Windows build 日志为 artifact；外部真实 provider smoke 单独保存 hash-bound 证据。
- N/A：本阶段不接入第三方 analytics/APM，以免扩大 Key/URL 隐私面。

### 4.7 并发、事务、缓存和一致性

- 单次 run 内样本串行，避免本机带宽竞争；同一页面只允许一个 active run。
- 取消必须 abort 当前 fetch 并阻止后续样本与 storage 写入。
- storage 更新使用单次 read-migrate-write；监听 `storage` event 同步多标签页，使用 ranAt/id 去重。
- benchmark API 使用 `Cache-Control: no-store`；站点静态资源可 immutable hash cache，HTML no-cache。
- N/A：无跨服务事务；计费请求不重试，不提供 exactly-once 保证。

## 5. 文件范围

### 5.1 允许新增/修改

- `engine/**`
- `server/**`
- `src/worker.ts`
- `site/src/**`
- `site/public/_headers`
- `src-tauri/**`（不含 `target/**`）
- `.github/workflows/**`
- `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `wrangler.toml`
- `.env.example`, `.gitignore`, `README.md`, `PLAN.md`, `PLAN-v2.md`
- `tests/**`, `playwright.config.ts`, `vitest.config.ts`, `eslint.config.js`
- `docs/ai-delivery/tasks/S01-trusted-benchmark.tasks.md` 仅 Task checkbox 与 Evidence 字段

### 5.2 禁止修改

- `.env`、任何真实 Key、用户系统配置。
- 本 PRD、Stage Spec、Implementation Prompt、Current Handoff 的需求/AC/状态。
- `site/dist/**`, `src-tauri/target/**`, `node_modules/**`, `.wrangler/**`, `.shots/**` 等生成物。
- Stage S02 候选功能、账号/数据库/服务端持久化。
- Git history 重写、force push、自动部署生产或创建付费资源。

## 6. Task 顺序与依赖

```text
T-001 quality baseline
  └─ T-002 domain contracts
       ├─ T-003 SSE/protocol
       │    └─ T-004 measurement/aggregation
       └─ T-005 secure proxy/request contract
                └─ T-006 transport + Tauri
T-004 + T-006 ──┬─ T-007 product flow/copy
                └─ T-008 storage/leaderboard
T-007 + T-008 ──── T-009 visual/a11y/responsive
T-005 + T-006 + T-009 ── T-010 deploy/docs/security headers
T-003..T-010 ── T-011 automated release gates
T-011 ── T-012 external Windows/live/provider evidence
```

若 T-012 外部证据不可取得，T-001–T-011 仍可完成，但 Receipt 必须为 `PARTIAL` 或 evidence-owner `BLOCKED`，不得伪造 READY_FOR_CHECK。

## 7. 验证矩阵

前置说明：以下 npm scripts 由 T-001/T-011 创建；依赖任务未完成前不得假称命令存在。

| AC | 层级 | 命令/方法 | 预期 | required | final_judge |
|---|---|---|---|---|---|
| AC-001 | unit/property | `npm run test:unit -- --run tests/unit/sse.test.ts tests/unit/measurement.test.ts` | fixture 全通过；无负值/空流 complete | yes | rerun |
| AC-002 | unit | `npm run test:unit -- --run tests/unit/aggregate.test.ts` | 1/3/5 与 partial/cancelled 矩阵通过 | yes | rerun |
| AC-003 | integration/e2e | `npm run test:integration -- --run tests/integration/transports.test.ts && npm run test:e2e -- --grep "transport consent"` | samples 不改变 transport；代理需确认 | yes | rerun |
| AC-004 | security integration | `npm run test:security` | 危险 URL/origin/limits/redirect 全拒绝且 mock upstream 0 次 | yes | rerun |
| AC-005 | unit/integration | `npm run test:unit -- --run tests/unit/request.test.ts && npm run test:integration -- --run tests/integration/protocols.test.ts` | URL 原样一次，协议请求 fixture 一致 | yes | rerun |
| AC-006 | unit/e2e | `npm run test:unit -- --run tests/unit/storage.test.ts && npm run test:e2e -- --grep "comparable leaderboard"` | 迁移幂等；不兼容/示例不混排 | yes | rerun |
| AC-007 | Windows/package | `npm run test:tauri-smoke` | Windows 包不访问项目 `/api`，1/3/5/取消成功 | yes | hash-bound-log |
| AC-008 | content/e2e | `npm run test:e2e -- --grep "copy and provenance"` | 传输/指标文案与状态匹配 | yes | rerun |
| AC-009 | e2e/a11y | `npm run test:a11y && npm run test:responsive` | 0 critical/serious；4 断点无页面横滚/hover-only | yes | rerun |
| AC-010 | visual/perf | `npm run test:visual && npm run check:bundle` | 主题/信息层级 snapshots 通过；初始 JS gzip ≤100KB | yes | rerun |
| AC-011 | full quality | `npm run typecheck && npm run lint && npm run test:unit -- --run && npm run test:integration -- --run && npm run build` | 全部退出 0；无未声明生成改动 | yes | rerun |
| AC-012 | deploy/docs | `npm run test:docs && npm run test:deploy-config`；Cloudflare preview smoke | 命令/拓扑/环境一致，health+site 通过 | yes | hash-bound-log |

额外机械检查：

- `git diff --check`
- `git status --short` 输出只允许当前 Task 已声明文件；Task commit 后必须为空。
- `git grep -n -E "API Key.*不上传|终极判据|任意模型|反映本机当前真实表现" -- README.md site/src` 应无无条件承诺；允许测试 fixture 中的旧文案断言。
- `git grep -n -E "apiKey|Authorization|x-api-key" -- ':!package-lock.json'` 由人工核对每个命中不写日志/storage/error。

## 8. 部署、回滚和数据恢复

### 8.1 部署

1. 先部署 Worker preview，配置 `CORS_ALLOWED_ORIGINS` 与 `ALLOWED_UPSTREAMS`，运行安全 smoke。
2. 再部署 Cloudflare Pages preview，`VITE_API_BASE` 指向 preview Worker；执行完整浏览器/可访问性验证。
3. Windows workflow 构建未签名测试安装包，实机验证后再发布 release。
4. 只有 Acceptance PASS 后才能更新生产 Pages/Worker 或正式 release；Implementer 不执行生产部署。

### 8.2 回滚

- Pages/Worker 使用上一个已验收 deployment 回滚；配置 allowlist 与代码版本成对恢复。
- Tauri release 保留上一版本资产，出现回归时撤回新 release，不自动覆盖用户本地数据。
- 代码回滚必须用普通 revert commit，不 reset/rewrite history。

### 8.3 本地数据恢复

- v2 迁移保留 `cpb:leaderboard:v1-backup`；出现迁移错误时读取备份并仅展示 legacy/unranked。
- 新版不得主动删除旧 key，直到用户明确执行“重置本地数据”。

## 9. 风险、假设与未决问题

### 9.1 已冻结假设

- 目标 provider 提供 OpenAI Chat Completions 或 Anthropic Messages 风格 SSE；其他协议不在本阶段。
- Cloudflare Pages/Worker 仍是主线上形态，Windows 是唯一桌面发布平台。
- 项目允许新增开发依赖用于测试/lint；生产运行依赖增量需说明 bundle 影响。
- Tauri 采用官方 HTTP 插件，不再实现 Node sidecar；这是本阶段冻结的架构方向。

### 9.2 风险控制

- server/engine 同时重构风险高：先用 characterization fixtures 固定错误/协议边界，再替换实现。
- UI 视觉重构不得先于 domain/transport contract，避免重复返工。
- 真实 provider smoke 消耗额度且属于 external evidence，必须最后执行并记录 owner/环境。

### 9.3 未决问题

N/A：没有会改变当前实现方向的未决问题。Cloudflare credentials、真实 Key、MSVC/Windows 实机是否可取得只影响 T-012 外部证据，不改变 T-001–T-011 的设计；缺失时按 Handoff 规则转 evidence owner，不由 Implementer猜测。
