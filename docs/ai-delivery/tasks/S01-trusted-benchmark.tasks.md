---
id: S01-TRUSTED-BENCHMARK-TASKS
title: S01 可信测速、受控传输与全端体验重构 Tasks
kind: tasks
version: 1
status: READY
baseline_sha: 00e9543977cd8b1262b60257af2a2b17352eafbf
related: CPB-PRD-001 (docs/ai-delivery/prd/trusted-benchmark.prd.md); S01-TRUSTED-BENCHMARK (docs/ai-delivery/stages/S01-trusted-benchmark.spec.md)
handoff_ref: docs/ai-delivery/handoffs/S01-trusted-benchmark.md
observed_handoff_revision: 1
---

# S01 Tasks

> 依赖顺序和实现契约以 Stage Spec 为准。Implementer 只可更新本文件的 checkbox 与 `Evidence`，不得修改 Covers/Files/Work/Verify/DoD。每个 Task 一个逻辑提交；失败时保持 `[ ]` 并停止依赖任务。

- [ ] T-001 建立覆盖真实源码的质量基线
  - Covers: FR-012, NFR-005, AC-011
  - Depends on: none
  - Evidence source: automated
  - Files: `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.js`, `vitest.config.ts`, `playwright.config.ts`, `tests/setup/**`, `site/src/lib/fetchResults.ts`, `site/src/lib/api.ts`, `site/src/components/Leaderboard.tsx`, `.gitignore`, `tsconfig.tsbuildinfo`
  - Work: 让根 TypeScript 配置覆盖 `engine/server/src/site/tests` 且与 Vite alias 一致；新增 `typecheck/lint/test:unit/test:integration/test:e2e` 基础 scripts 与测试配置；删除或修复 v1 死引用、未使用符号和 Vite env 类型；移除被跟踪的非必要 incremental build 产物并忽略确定性缓存。只建立门禁和修复当前静态错误，不改变测速语义。
  - Verify: `npm run typecheck && npm run lint && npm run test:unit -- --run --passWithNoTests && npm run build`；全部退出 0，且 TypeScript 实际列出的 root files 包含 `engine/bench.ts` 与 `site/src/App.tsx`
  - Definition of done: 当前审计发现的 5 个完整类型错误消失；所有后续 Verify 入口真实存在；构建/测试不会修改 tracked 文件。
  - Commit: `chore(quality): establish full-repo verification baseline`
  - Evidence: pending

- [ ] T-002 固化 benchmark profile、结果和错误领域契约
  - Covers: FR-002, FR-003, FR-004, FR-005, FR-008, NFR-002, AC-001, AC-002, AC-005, AC-006
  - Depends on: T-001
  - Evidence source: automated
  - Files: `engine/types.ts`, `engine/profiles.ts`, `engine/errors.ts`, `engine/measurement.ts`, `engine/aggregate.ts`, `tests/fixtures/**`, `tests/unit/types.test.ts`, `tests/unit/profiles.test.ts`
  - Work: 定义 Spec 中的 profile、typed protocol events、SampleResult、BenchmarkRunResult、TransportKind、stable error codes 与 schema version；提供固定 `cpb-standard@1` profile 和 hash；明确 null/finite/non-negative 不变量。此任务只实现类型、常量、纯校验和 fixture，不接线旧 bench 流程。
  - Verify: `npm run test:unit -- --run tests/unit/types.test.ts tests/unit/profiles.test.ts && npm run typecheck`；schema/profile/hash/错误码 fixtures 全通过
  - Definition of done: 指标和状态不再依赖布尔 `success`；profile/measurement/schema 版本可序列化且有测试锁定；Key 不属于任何可持久化 result 类型。
  - Commit: `feat(engine): define versioned benchmark contracts`
  - Evidence: pending

- [ ] T-003 重写 SSE parser 与双协议事件适配器
  - Covers: FR-004, NFR-002, AC-001, AC-005
  - Depends on: T-002
  - Evidence source: automated
  - Files: `engine/parse-sse.ts`, `engine/protocols/anthropic.ts`, `engine/protocols/openai.ts`, `engine/protocols/index.ts`, `tests/unit/sse.test.ts`, `tests/unit/protocols.test.ts`, `tests/fixtures/sse/**`
  - Work: 按 SSE 空行事件边界解析 LF/CRLF、任意 chunk、多 `data:` 行、comment/heartbeat、UTF-8 decoder flush 和 EOF 尾事件；parser 输出原始 data，不吞 JSON 错误。协议 adapter 负责 JSON、thinking/reasoning、text、usage、finish 和 provider error 归一化。
  - Verify: `npm run test:unit -- --run tests/unit/sse.test.ts tests/unit/protocols.test.ts`；Stage 验证矩阵全部 fixture 通过，非法 JSON 产生稳定 parse error 而非静默成功
  - Definition of done: 本轮审计的 CRLF=0 复现测试先失败后通过；parser 与 provider event semantics 分层；未知合法 SSE 字段不会破坏后续事件。
  - Commit: `fix(engine): parse SSE streams across protocol variants`
  - Evidence: pending

- [ ] T-004 重建单样本计时与多样本聚合
  - Covers: FR-003, FR-004, FR-005, FR-006, NFR-002, AC-001, AC-002
  - Depends on: T-003
  - Evidence source: automated
  - Files: `engine/bench.ts`, `engine/measurement.ts`, `engine/aggregate.ts`, `tests/unit/measurement.test.ts`, `tests/unit/aggregate.test.ts`, `tests/integration/bench.test.ts`
  - Work: 统一 requestStart/firstReasoning/firstText/lastText/streamEnd 时间线；TTFT 只取首个非空 text；thinking 仅在 reasoning→text 存在时返回；provider usage 缺失时 token/TPS 为 null；TPS 逐样本计算后取中位数；实现 complete/partial/failed/cancelled、progress callback 与 AbortSignal。删除字符数 token 伪估。
  - Verify: `npm run test:unit -- --run tests/unit/measurement.test.ts tests/unit/aggregate.test.ts && npm run test:integration -- --run tests/integration/bench.test.ts`；空流/仅正文/partial/cancel 全符合 AC-001/002
  - Definition of done: 不存在负/NaN/Infinity 指标；仅正文 thinking 为 null；空流 failed；partial 不可排名；默认 profile 足以采集吞吐且版本入结果。
  - Commit: `fix(engine): make benchmark metrics reproducible`
  - Evidence: pending

- [ ] T-005 统一完整 Request URL 并收紧代理边界
  - Covers: FR-001, FR-002, FR-007, NFR-001, AC-003, AC-004, AC-005
  - Depends on: T-002
  - Evidence source: automated
  - Files: `engine/request.ts`, `engine/bench.ts`, `server/index.ts`, `server/config.ts`, `server/validation.ts`, `server/security.ts`, `src/worker.ts`, `wrangler.toml`, `.env.example`, `tests/unit/request.test.ts`, `tests/integration/protocols.test.ts`, `tests/integration/proxy-security.test.ts`
  - Work: 删除分散 path 拼接，完整 Request URL 原样使用；实现协议请求 fixture；server 做 body/字段/profile/samples 上限、Origin、HTTPS、credentials/fragment/port、host+path allowlist、IP/private target、manual redirect 和脱敏错误校验；为 Worker/Node 提供环境配置接口与 request-id/no-store；不引入通用任意 URL relay。
  - Verify: `npm run test:unit -- --run tests/unit/request.test.ts && npm run test:integration -- --run tests/integration/protocols.test.ts && npm run test:security`；危险矩阵全部拒绝，mock upstream 对拒绝请求调用数为 0
  - Definition of done: OpenAI `/v1` 不再重复；公共代理只能访问结构化 allowlist；samples 只允许 1/3/5；任何响应/日志 fixture 不含 Key 或上游 body。
  - Commit: `feat(proxy): enforce trusted upstream policy`
  - Evidence: pending

- [ ] T-006 实现显式 browser/proxy/Tauri transport 与取消
  - Covers: FR-001, FR-006, FR-009, NFR-001, NFR-004, AC-003, AC-007
  - Depends on: T-004, T-005
  - Evidence source: automated
  - Files: `site/src/lib/api.ts`, `site/src/lib/runtime.ts`, `site/src/lib/transports/**`, `site/src/hooks/useBenchmarkRun.ts`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`, `src-tauri/tauri.conf.json`, `tests/integration/transports.test.ts`, `tests/unit/runtime.test.ts`
  - Work: 用一个 orchestrator 保持 samples 与 transport 正交；browser-direct 直接向 provider；trusted-proxy 只有显式 consent token 后调用 Worker；Tauri 使用官方 HTTP plugin/native fetch adapter 复用 engine；暴露 progress/AbortSignal；生产 Tauri 不引用 `/api`。配置最小插件权限和非 null CSP。
  - Verify: `npm run test:integration -- --run tests/integration/transports.test.ts && npm run typecheck && npm run build && cargo check --locked --manifest-path src-tauri/Cargo.toml`；自动 transport fixtures 通过；若本机缺 MSVC，只允许 cargo 命令记录为环境 blocked，不得声称 AC-007 通过
  - Definition of done: samples=3/5 不再改变 transport；CORS failure 不自动代理；Tauri adapter 单测证明不调用 project API；取消会 abort 当前样本并阻止持久化。
  - Commit: `feat(runtime): add explicit local and remote transports`
  - Evidence: pending

- [ ] T-007 重构可信测速主流程与专业文案
  - Covers: FR-001, FR-005, FR-006, FR-010, NFR-004, AC-003, AC-008
  - Depends on: T-004, T-006
  - Evidence source: automated
  - Files: `site/src/App.tsx`, `site/src/components/BenchForm.tsx`, `site/src/components/SecurityBanner.tsx`, `site/src/components/ResultCard.tsx`, `site/src/components/RunProgress.tsx`, `site/src/components/TransportSelector.tsx`, `site/src/components/Methodology.tsx`, `site/src/content/copy.ts`, `tests/e2e/benchmark-flow.spec.ts`, `tests/e2e/copy-provenance.spec.ts`
  - Work: 把首屏重排为紧凑价值说明→transport/Key 路径→表单；改完整 Request URL 与真实示例；加入代理 consent、样本进度、取消、partial/failed/error code、token unavailable 和方法学说明；移除“任意模型/Key不上传/本机真实/终极判据”等无条件承诺。
  - Verify: `npm run test:e2e -- --grep "transport consent|copy and provenance|progress and cancel"`；三 transport 文案与执行状态一致，默认主流程不发送到代理
  - Definition of done: 用户在提交前知道 Key 路径；失败有可执行建议；进度/取消/partial 清晰；所有受审计文案有实现事实支撑。
  - Commit: `feat(ui): make benchmark trust and progress explicit`
  - Evidence: pending

- [ ] T-008 迁移本地数据并建立可比较榜单
  - Covers: FR-003, FR-005, FR-008, NFR-002, NFR-005, AC-002, AC-006
  - Depends on: T-004, T-006
  - Evidence source: automated
  - Files: `engine/types.ts`, `site/src/lib/storage.ts`, `site/src/data/demo-results.v2.json`, `site/src/components/Leaderboard.tsx`, `site/src/components/ResultCard.tsx`, `site/public/results.json`, `tests/unit/storage.test.ts`, `tests/unit/comparability.test.ts`, `tests/e2e/leaderboard.spec.ts`
  - Work: 实现 v1 backup + 幂等 v2 migration；定义 comparability key；按 profile/measurement/transport/status/token source 过滤；示例独立分区且带 provenance；保存安全 URL display 字段，不存 query/credentials；删除重复/失效 v1 results 数据路径。
  - Verify: `npm run test:unit -- --run tests/unit/storage.test.ts tests/unit/comparability.test.ts && npm run test:e2e -- --grep "comparable leaderboard"`；旧/损坏/多标签页/示例/partial fixtures 通过
  - Definition of done: 旧数据不丢但不伪装可排名；demo 不获得正式“最优”；只有兼容 complete 数据参与对应 metric 排名；清除行为可恢复/确认。
  - Commit: `feat(leaderboard): compare only compatible benchmark runs`
  - Evidence: pending

- [ ] T-009 完成响应式视觉系统、无障碍和 reduced-motion
  - Covers: FR-010, FR-011, NFR-003, NFR-004, AC-009, AC-010
  - Depends on: T-007, T-008
  - Evidence source: automated
  - Files: `site/src/App.tsx`, `site/src/main.tsx`, `site/src/components/**`, `site/src/styles/globals.css`, `site/index.html`, `site/design-system/MASTER.md`, `design-system/coding-plan-bench/MASTER.md`, `tests/e2e/accessibility.spec.ts`, `tests/e2e/responsive.spec.ts`, `tests/e2e/visual.spec.ts`
  - Work: 合并冲突设计系统为一个事实源；建立紧凑工作台层级、统一 spacing/type/color/focus/empty/error/loading tokens；移动端常显操作与 44px hit target；增加 icon names、fieldset/legend、tablist/tab selected、aria-live/status/alert；把组件 `<style>` 移到静态 CSS；用 `useReducedMotion` 停止 JS 动画；修正 theme 初始闪烁和系统偏好。
  - Verify: `npm run test:a11y && npm run test:responsive && npm run test:visual`；375/768/1024/1440 和 light/dark/reduced-motion snapshots 通过，0 critical/serious，页面级无横向滚动
  - Definition of done: 移动端没有 hover-only 操作；所有 icon-only 控件有名称；键盘完成主流程；设计文档与 token/组件实现一致。
  - Commit: `feat(design): deliver accessible responsive workbench`
  - Evidence: pending

- [ ] T-010 统一 Cloudflare 部署、安全 headers 与项目文档
  - Covers: FR-007, FR-010, FR-012, NFR-001, NFR-005, AC-004, AC-008, AC-012
  - Depends on: T-005, T-006, T-009
  - Evidence source: automated
  - Files: `.github/workflows/deploy-site.yml`, `.github/workflows/deploy-worker.yml`, `site/public/_headers`, `wrangler.toml`, `vite.config.ts`, `.env.example`, `README.md`, `PLAN.md`, `PLAN-v2.md`, `package.json`, `tests/config/**`
  - Work: 选定 Cloudflare Pages+Worker 为唯一主拓扑；workflow 显式配置 API base、origin/upstream policy 和 preview/production 分离，不自动创建付费资源；加入站点 headers/CSP；README 说明三 transport、隐私边界、指标定义、限制、准确命令和 Windows 状态；旧 PLAN 标记 superseded；package description 去除 GLM-5.2 限定。
  - Verify: `npm run test:docs && npm run test:deploy-config && npm run build`；文档命令存在、workflow 与 README 拓扑一致、构建产物含 headers、无旧无条件承诺
  - Definition of done: README/CI/线上主域一致；GitHub Pages 不再被误作主部署；安全配置可由测试解析；生产部署仍需 T-012 owner 证据。
  - Commit: `docs(platform): align deployment privacy and operations`
  - Evidence: pending

- [ ] T-011 固化全量自动验收与 bundle 门禁
  - Covers: FR-012, NFR-003, NFR-005, AC-001, AC-002, AC-003, AC-004, AC-005, AC-006, AC-008, AC-009, AC-010, AC-011
  - Depends on: T-003, T-004, T-005, T-006, T-007, T-008, T-009, T-010
  - Evidence source: automated
  - Files: `package.json`, `package-lock.json`, `.github/workflows/quality.yml`, `tests/**`, `scripts/check-bundle.mjs`, `scripts/check-clean.mjs`
  - Work: 补齐跨模块回归、mock upstream、browser e2e/a11y/visual/responsive、bundle analyzer 和验证后工作区 clean 检查；CI 对 PR/main 使用 locked install 并上传原始报告；测试不得访问真实 provider 或用 mock 冒充 T-012 外部证据。
  - Verify: `npm run verify`；它必须串行/明确运行 typecheck、lint、unit、integration、security、e2e、a11y、responsive、visual、build、bundle、clean，全部退出 0
  - Definition of done: `npm run verify` 是自动验收单入口；初始 JS gzip ≤100KB；CI 失败能定位子门禁；无测试生成物污染 tracked 工作区。
  - Commit: `test(quality): enforce release-grade verification`
  - Evidence: pending

- [ ] T-012 获取 Windows、Cloudflare preview 与真实 provider 外部证据
  - Covers: FR-007, FR-009, FR-012, NFR-001, AC-003, AC-004, AC-007, AC-012
  - Depends on: T-011
  - Evidence source: environment
  - Files: `docs/ai-delivery/tasks/S01-trusted-benchmark.tasks.md` 仅本 Task Evidence；仓库外 implementation artifact root 下的日志、截图、网络记录、安装包 hash 和 deployment URLs
  - Work: 由 repo maintainer/Cloudflare owner 提供 preview secrets 和边缘 rate-limit；在 GitHub Windows runner 构建安装包并在真实 Windows 机器完成 1/3/5/取消 smoke，证明不访问项目 `/api`；在 Cloudflare preview 验证 health、origin/upstream 拒绝、安全 headers；使用授权真实 provider Key 各跑最少一个 direct/local/approved-proxy 场景，Key/额度由 owner 控制。不得自动生产部署、购买资源或把 Key 写入证据。
  - Verify: `npm run test:tauri-smoke && npm run test:preview-smoke`；并核对 hash-bound CI logs、安装包 SHA-256、网络 host 清单、preview URL、rate-limit 配置证据与脱敏 provider result
  - Definition of done: AC-007/012 的外部子句全部有可访问证据；证据不含 Key；缺任一必需环境/人工证据时保持 `[ ]` 并在 Receipt 标为 `PARTIAL/BLOCKED`，blocker owner=`repo maintainer/Cloudflare owner`。
  - Commit: `chore(release): record external validation evidence`
  - Evidence: pending
