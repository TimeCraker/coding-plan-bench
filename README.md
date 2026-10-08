# Coding Plan Bench

> 可信测速台 · 选择连接方式，测量 **TTFT / TPS / Total**，同条件榜单对比

支持 Anthropic 兼容与 OpenAI 兼容双协议服务。内置 **glm-5.3 世代模型矩阵**（智谱 `glm-5.3` / `glm-5.3-flash` / `glm-5.3-flashx` 同 key 三档直对比，外加方舟 / 千帆 / DeepSeek / Kimi 渠道），表单一键快选，CLI 一条命令跑完编码用例矩阵。

🌐 **[在线使用](https://coding-plan-bench.pages.dev/)** ｜ 💻 **[下载 Windows 本地版](https://github.com/TimeCraker/coding-plan-bench/releases)**

---

## 三种连接方式（Key 路径是一等公民）

测速前先选择连接方式——它决定你的 API Key 经过哪条链路，取样次数（1/3/5）不会改变它：

| 连接方式 | 请求路径 | Key 去向 | 限制 |
|----|------|---------|------|
| 🌐 **浏览器直连**（默认） | 浏览器 → 模型厂商 | 只存在于浏览器内存与发往厂商的请求中，不经项目服务器 | 厂商需开放浏览器 CORS；失败时不会自动改走代理 |
| 🔁 **中转代理**（需当次确认） | 浏览器 → 项目 Worker → 厂商 | 经项目 Worker **内存转发**，不写入应用存储；服务运营方与平台仍在传输链路 | 仅支持受信上游列表（HTTPS + host/path 精确匹配）；不追随重定向；每次使用需当次确认 |
| 💻 **本地软件**（Windows） | 本地软件 → 模型厂商 | 全程留在你的设备与厂商之间 | 无需远端代理即可完成 1/3/5 次取样与取消 |

榜单数据只保存在你的浏览器 localStorage（schema v2，含 profile/测量版本/transport 来源；旧数据自动迁移为"遗留·不可排名"）。跨连接方式 / profile 的结果不直接可比，默认只在同条件组内排名。

## 部署拓扑（Cloudflare Pages + Workers，唯一主站事实源）

```
                    ┌─────────────────────────┐
                    │  engine/ (同构 TS 引擎)   │
                    │  请求构造 → SSE 解析       │
                    │  → 计量 → 聚合（schema v2）│
                    └────────────┬────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
   🌐 浏览器直连            ☁️ Worker 代理            💻 本地软件
   (Cloudflare Pages 前端)  (Cloudflare Workers)      (Tauri · Windows)
   默认连接方式             受信上游 allowlist        官方 HTTP 插件
                           需当次确认                 Key 不出本机
```

| 端 | 地址 | 部署入口 |
|----|------|---------|
| 🌐 **站点前端** | [coding-plan-bench.pages.dev](https://coding-plan-bench.pages.dev/) | `.github/workflows/deploy-site.yml`（main→production，PR→preview） |
| ☁️ **Worker API** | coding-plan-bench-api.timecraker-ace.workers.dev | `.github/workflows/deploy-worker.yml`（含 origin/upstream 边界 vars） |

> GitHub Pages 不再作为主部署；站点安全头（CSP/HSTS/nosniff/frame 防护）见 `site/public/_headers`，随构建产物发布。

## 测什么（指标口径）

| 指标 | 口径 | 说明 |
|------|------|------|
| **TTFT** | 请求发出 → 第一个非空可见正文 delta | 思考（reasoning）阶段不计入 |
| **TPS** | 上游 usage 输出 token ÷ 正文生成区间 | 逐样本计算后取中位数；**上游未返回 usage 时为空且不参与 TPS 排名**（不用字符数估算） |
| **Total** | 请求发出 → 流结束 | 完整度参量之一，不是唯一判据 |

测试条件由版本化 profile 锁定（`cpb-standard@1`：固定 prompt + sha256、温度 0、max_tokens 1024）；多条取样（1/3/5）逐样本计量后取中位数，完整/部分成功/失败/已取消四态分开呈现，部分成功不进入默认排名。方法学细节见站内「方法学与口径」。

## 模型矩阵（glm-5.3 世代）

模型矩阵的单一事实源在 [`engine/models.ts`](engine/models.ts)，2026-10-06 依各厂官方文档调研更新；**新增渠道项均未经本台实测**，端点与模型 ID 以官方文档核验为准：

| 渠道 | 模型 | envVar | 状态 |
|------|------|--------|------|
| 智谱 | `glm-5.3` / `glm-5.3-flash` / `glm-5.3-flashx` | `ZHIPU_API_KEY`（一把 key 三档直对比，flashx 官方标称 200 tps） | glm-5.3/flash 已实测，flashx 未实测 |
| 火山方舟 | `glm-5.3[1m]` | `VOLCENGINE_CODING_API_KEY` | 未实测 |
| 百度千帆 | `glm-5.3` / `deepseek-v4.1-flash` | `QIANFAN_API_KEY` | 未实测 |
| DeepSeek 官方 | `deepseek-flash` | `DEEPSEEK_API_KEY` | 未实测；Anthropic 兼容端点官方确认，峰谷计价 |
| Kimi 官方 | `kimi-k3` | `KIMI_API_KEY` | 未实测；官方 Anthropic Messages API 兼容端点 |

另有 GLM-5.2 三渠道存量对照（智谱 / 方舟 / 千帆，2026-07-31 实测过）。两处消费：

- **网站快选**：测速表单顶部芯片，点击预填完整 Request URL / model / 协议（key 永不预填）
- **CLI 矩阵跑分**：4 条区分档位的编码用例 × 矩阵中所有有 key 的模型，串行 + 间隔频控 + 失败重试，产出中位数汇总与可复现的原始 JSON：

```bash
cp .env.example .env   # 填 ZHIPU_API_KEY；其余渠道按上表 envVar 增设（key 缺失自动跳过）
npm run bench:matrix   # 结果写入 results/data/，报告见 results/
```

> 中转代理目前仅放行智谱端点（allowlist 由运营方配置）；方舟 / 千帆 / DeepSeek / Kimi 渠道请走浏览器直连或本地软件。

最新一轮实测（2026-10-05，temperature=0，32/32 成功）：**GLM-5.3 端到端中位 19.9s / 89 TPS，GLM-5.3-Flash 34.7s / 64 TPS；中高难用例上两档答案质量打平**——详见 [results/2026-10-05-glm-5.3-matrix.md](results/2026-10-05-glm-5.3-matrix.md)。

## 隐私与限制

- 🔑 Key 只存在于当前运行内存与你所选连接方式的请求链路；不进入 localStorage、日志、URL 或错误文本
- 🔁 公共代理不是任意转发器：仅受信 HTTPS 上游（host+path 精确 allowlist），拒绝 IP/私网/localhost/非 443 端口/重定向/超限请求，全部在发起上游请求前拦截
- ⚠️ 已知限制：仅支持 Anthropic / OpenAI 兼容协议；代理只开放配置列表内的目标（其它服务请用浏览器直连或本地软件）；不同连接方式的网络路径不同，跨条件比较需显式切换分组

## 本地开发

```bash
git clone https://github.com/TimeCraker/coding-plan-bench.git
cd coding-plan-bench
npm install
```

### 质量命令（全部真实存在）

```bash
npm run typecheck       # 全仓 TS（engine/server/src/site/tests）
npm run lint            # eslint（含 react-hooks）
npm run test:unit       # 单元测试（vitest，node 环境，禁真实网络）
npm run test:integration# 集成测试（transport/协议/引擎接线）
npm run test:security   # 代理边界危险矩阵（mock upstream 0 次调用）
npm run test:e2e        # Playwright 全量浏览器测试（默认用系统 Edge）
npm run test:a11y       # 无障碍（Axe 0 critical/serious）
npm run test:responsive # 响应式（375/768/1024/1440 无横滚）
npm run test:visual     # 视觉快照（light/dark + reduced-motion）
npm run build           # 类型检查 + 前端构建（site/dist）
npm run verify          # 发布级验收单入口：typecheck→lint→全部测试→build→check:bundle/check:clean 串行
npm run dev             # 前端开发 (http://localhost:5173)
npm run server          # Node 后端 API (localhost:8787，可选)
npm run bench:matrix    # CLI 模型矩阵跑分（读 env key）
npm run tauri dev       # Tauri 本地软件 开发（需 Rust + MSVC）
npm run tauri build     # Windows 安装包
```

开发时前端通过 Vite proxy 把 `/api` 转发到 `localhost:8787`（见 `vite.config.ts`）。

### 自部署后端（替代 Worker）

同一份 Hono 代码可跑在任意 Node 服务器（额外做 DNS 私网校验，防 DNS rebinding）：

```bash
CORS_ALLOWED_ORIGINS=https://your-site.example \
ALLOWED_UPSTREAMS="open.bigmodel.cn|/api/anthropic/v1/messages" \
node --import tsx server/node.ts
```

前端通过 `VITE_API_BASE` 指向你的后端：`VITE_API_BASE=https://your-server.com/api npm run build`。

## Windows 本地版状态

Tauri 2 壳 + 官方 HTTP 插件（`tauri-local` 连接方式），生产链路不访问项目 `/api`；CSP 非 null、capabilities 仅放行 HTTPS 远程目标。安装包未签名，由 [Build Windows App](https://github.com/TimeCraker/coding-plan-bench/actions/workflows/build-windows.yml) workflow 在 GitHub Windows runner 构建。实机 1/3/5 取样与取消的外部验证证据由 owner 在发布前补齐（T-012）。

---

## 部署（owner 手动/CI）

```bash
# Worker API（先部署，边界 vars 见 deploy-worker.yml）
npx wrangler deploy --var CORS_ALLOWED_ORIGINS:https://coding-plan-bench.pages.dev \
  --var ALLOWED_UPSTREAMS:"open.bigmodel.cn|/api/anthropic/v1/messages"

# 站点（Cloudflare Pages）
VITE_API_BASE=https://coding-plan-bench-api.timecraker-ace.workers.dev/api \
  npm run build
npx wrangler pages deploy site/dist --project-name=coding-plan-bench --branch=main
```

push 到 main 只触发 CI 部署 workflow；acceptance 未通过前不发布正式 release（见 `docs/ai-delivery/`）。

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 前端 | Vite 7 · React 19 · TypeScript 5.7 · Tailwind CSS v4 · 纯 CSS 动效 | Swiss Industrial Print 单浅色主题（纸感底/墨层级/珊瑚单强调/零圆角/硬阴影，与 agent-hive 同源），大白话文案基线；响应式 375–1440；framer-motion 与 lucide-react 已移除（初始 JS gzip 83.3KB，`check:bundle` ≤100KB 门禁） |
| 引擎 | TypeScript（同构） | 一份代码三端复用：请求构造/SSE 解析/计量/聚合，schema v2 |
| 后端 | Hono | 同构 Cloudflare Worker + Node（结构化 allowlist 边界） |
| 本地软件 | Tauri 2 + plugin-http | Windows，复用前端与引擎 |
| CI/CD | GitHub Actions | 质量门禁 + Pages/Worker 部署 + Windows 构建 |

## 项目结构

```
coding-plan-bench/
├─ engine/            # 同构测速引擎（三端共用）
│  ├─ request.ts      # 完整 Request URL 原样 + 协议 headers/body 构造
│  ├─ parse-sse.ts    # SSE 帧解析（LF/CRLF/CR、任意 chunk、EOF flush）
│  ├─ protocols/      # anthropic/openai 事件归一化 adapter
│  ├─ measurement.ts  # 单样本时间线 reducer（TTFT/thinking/generation）
│  ├─ aggregate.ts    # 逐指标中位数 + complete/partial/failed/cancelled
│  ├─ profiles.ts     # cpb-standard@1 + 纯 TS sha256
│  ├─ types.ts        # 共享类型契约（profile/结果/错误码，schema v2）
│  ├─ errors.ts       # 12 个稳定错误码
│  ├─ bench.ts        # runSample/runBenchmark 编排 + v1 CLI 兼容壳
│  └─ models.ts       # 模型矩阵（单一事实源）
├─ bench/             # CLI 矩阵跑分 (npm run bench:matrix)
├─ server/            # Hono 可信代理（config/validation/security/index/node）
├─ src/worker.ts      # Cloudflare Worker 入口（env 配置）
├─ site/              # 前端 (Vite + React)
│  ├─ src/lib/transports/  # browser-direct / trusted-proxy(consent) / tauri-local
│  ├─ src/hooks/useBenchmarkRun.ts  # 状态机 + 取消
│  ├─ src/content/copy.ts   # 文案单一事实源
│  └─ public/_headers # CSP/HSTS 等安全头
├─ tests/             # unit / integration / e2e / config（禁真实网络）
├─ src-tauri/         # Tauri 本地软件（Rust 壳 + HTTP 插件）
├─ .github/workflows/ # CI: 质量门禁 + Pages/Worker 部署 + Windows 构建
└─ docs/ai-delivery/  # PRD / Stage Spec / Tasks / Handoff（权威输入）
```

## License

MIT
