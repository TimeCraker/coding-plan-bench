# Coding Plan Bench — 订阅套餐模型测速台

> 状态：**计划阶段（Plan Mode）** — 待用户确认后再动业务代码
> 创建：2026-07-31
> 仓库：`TimeCraker/coding-plan-bench`（待建，纯静态前端 + Node 测速引擎）

## 一、项目定位

对比三家厂商的 **GLM-5.2 订阅套餐**在真实编码场景下的响应速度，回答一个问题：

> **「同样问 GLM-5.2，哪家套餐的 token 出得快、首响应来得早？」**

面向人群：自己（选套餐用）+ 同样在智谱/火山/百度 Coding Plan 之间纠结的开发者。

### 三家被测对象

| 厂商 | 套餐 | Endpoint（Anthropic 兼容） | 环境变量 | model id |
|------|------|---------------------------|---------|----------|
| 智谱 | GLM Coding Plan | `https://open.bigmodel.cn/api/anthropic` | `ZAI_CODING_CN_API_KEY` | `glm-5.2` |
| 火山方舟 | Ark Coding Plan | `https://ark.cn-beijing.volces.com/api/coding` | `VOLCENGINE_CODING_API_KEY` | `glm-5.2[1m]` |
| 百度千帆 | Qianfan Token Plan | `https://qianfan.baidubce.com/anthropic/tokenplan/personal` | `QIANFAN_API_KEY` | `glm-5.2` |

> 三家都是 Anthropic 兼容协议 → 测速引擎用**同一套请求代码**，只切 base_url/key/model，保证公平。
> model id 差异已在 curl 实测中确认（智谱不认 `[1m]`、火山认），各家用其 endpoint 认的 id。

---

## 二、核心架构决策（必须先讲清）

### ❌ 为什么不能「纯前端点按钮测速」

浏览器直接调三家 API 有两个硬伤：

1. **CORS**：三家 anthropic endpoint 大概率不放行浏览器跨域（`Access-Control-Allow-Origin`），fetch 会被浏览器拦截。
2. **Key 泄露**：API key 写进前端 = 公开给所有访客，被盗刷套餐额度。

### ✅ 采用架构：测速引擎 + 静态前端 + 可选 CI

```
┌─────────────────┐     results.json     ┌──────────────────┐
│  测速引擎 (Node) │ ───────────────────▶ │  静态前端 (Vite)  │
│  带 key 调 API   │   (TTFT/TPS/耗时)    │  可视化对比展示   │
│  本地或 CI 跑    │                      │  部署 GitHub Pages│
└─────────────────┘                      └──────────────────┘
        ▲                                          ▲
        │ $XXX_API_KEY                             │ fetch results.json
   本地 .env /                            前端纯静态，无后端，
   GitHub Secrets (CI)                    访问即看数据
```

**三层数据来源（用户按需选）**：

| 方式 | 命令 | 适合 | 成本 |
|------|------|------|------|
| **A. 本地手动跑** | `npm run bench` | 想看自己网络下的真实数据 | 仅消耗自己套餐额度 |
| **B. CI 手动触发** | GitHub Actions `workflow_dispatch` | 想看云端网络数据 | 消耗套餐额度（可控次数）|
| **C. CI 定时** | 每日定时跑一次 | 积累历史趋势 | 每天消耗少量额度 |

> 默认 A；B/C 为可选增强，需在 GitHub Secrets 配三家 key。前端始终纯静态，读 `results.json` 展示。

---

## 三、测速指标与方法论

### 3.1 指标定义

| 指标 | 含义 | 单位 | 为什么测 |
|------|------|------|---------|
| **TTFT** | Time To First Token，首 token 到达延迟 | ms | **响应快慢** — 用户体感最关键（"谁响应更快"）|
| **TPS** | Tokens Per Second，输出速度 | tok/s | **生产效率**（"谁 token 输出快"）|
| **Total** | 总响应耗时 | ms | 端到端体感 |
| **Output Tokens** | 实际输出 token 数 | 个 | 校验 TPS 分母 |
| **Success** | 成功率 | % | 稳定性 |

> 用户关心的「速度」= **TTFT（响应快）+ TPS（输出快）**，这两个是主指标，前端重点呈现。

### 3.2 公平性保证

- **同 prompt**：固定测试集（代码生成 / 代码解释 / 补全 三类，每类 2 条 = 6 条）
- **同参数**：`max_tokens=512`、`temperature=0`、`thinking` 统一（按各家默认，记录在元数据）
- **串行不并发**：一家一家测，避免互相抢带宽污染数据
- **多次取样取中位数**：每家每 prompt 跑 3 次，取中位数（去掉网络抖动尖刺）
- **流式采集 TTFT**：用 SSE 流式响应，记录第一个 content delta 的时间戳
- **记录环境元数据**：时间戳、网络类型（本地/CI）、node 版本，便于横向对比

### 3.3 测速引擎工作流

```
bench/
  ├─ engine.ts        # 核心：fetch + SSE 流式计时
  ├─ providers.ts     # 三家配置（base_url/key/model 从 env 读）
  ├─ prompts.ts       # 固定测试集
  └─ run.ts           # 编排：串行遍历 provider × prompt × 3次 → 汇总
```

输出 `site/public/results.json`：
```json
{
  "meta": { "ranAt": "2026-07-31T...", "runner": "local", "node": "v24" },
  "providers": [
    { "id": "zhipu", "name": "智谱 GLM Coding Plan", "endpoint": "...", "model": "glm-5.2" },
    { "id": "volcengine", "name": "火山方舟 Coding Plan", "endpoint": "...", "model": "glm-5.2[1m]" },
    { "id": "baidu", "name": "百度千帆 Token Plan", "endpoint": "...", "model": "glm-5.2" }
  ],
  "results": [
    { "provider": "zhipu", "prompt": "code-gen-1", "run": 1, "ttft": 420, "tps": 88.3, "total": 6100, "outputTokens": 498, "success": true }
    // ... 每家 × 6 prompt × 3 次 = 18 条/家
  ],
  "summary": [
    { "provider": "zhipu", "ttftMedian": 410, "tpsMedian": 87.5, "totalMedian": 6050, "wins": 3 }
    // ... 每家一行汇总，wins = 该家在多少 prompt 上最快
  ]
}
```

---

## 四、技术栈选型

### 4.1 前端（轻量但功能强大）

| 层 | 选型 | 理由 |
|----|------|------|
| 构建 | **Vite** | 最快冷启动，原生 ESM，产物小 |
| 框架 | **React 19 + TypeScript** | 主流可维护，TS 保类型安全 |
| 样式 | **Tailwind CSS v4** | 与 ui-ux-pro-max skill 默认栈一致，utility-first 快 |
| 动效 | **Framer Motion** | 与 motion-principles skill 一致，声明式动效 |
| 图表 | **自绘 SVG + Framer Motion** | 数据简单（柱状对比+折线趋势），零重型图表依赖，动效可控 |
| 图标 | **Lucide React** | skill 规范「不用 emoji，用 SVG 图标集」|
| 部署 | **GitHub Pages** | 纯静态，免费，和仓库一体 |

> 不引入 recharts/chart.js 等图表库：测速数据维度少（对比 + 趋势），自绘 SVG 更轻（<5KB）且动效由 Framer Motion 统一驱动，符合「轻量但功能强大」。

### 4.2 测速引擎

| 层 | 选型 | 理由 |
|----|------|------|
| 运行时 | **Node.js + TypeScript** | 与前端同语言，复用类型定义 |
| HTTP | **原生 fetch + ReadableStream** | Node 18+ 内置，流式采 TTFT，零依赖 |
| 配置 | **dotenv** | 从 `.env` 读三家 key |
| CLI | **原生 process.argv** | 简单，不上 commander |

> 引擎零运行时依赖（只 dotenv），可移植。

### 4.3 CI（可选）

- **GitHub Actions**：`workflow_dispatch`（手动）+ 可选 `schedule`（每日）
- 用 `secrets.ZAI_CODING_CN_API_KEY` 等注入 key
- 跑完 bench → commit `results.json` → 自动部署 Pages

---

## 五、前端功能与页面设计

### 5.1 设计系统（参照 ui-ux-pro-max skill）

启动时跑 skill 的 design-system 搜索定位风格：
```bash
python3 scripts/search.py "developer dashboard benchmark performance dark" --design-system -p "Coding Plan Bench"
```

**预设方向**（待 skill 搜索确认）：
- **风格**：暗色优先开发者仪表盘（developer dashboard）+ 轻量 glassmorphism 卡片
- **调色板**：深色背景（slate-950）+ 三家厂商各一个品牌色作为数据色
  - 智谱 → 蓝紫 `#6366f1`
  - 火山 → 橙红 `#f97316`
  - 百度 → 蓝色 `#3b82f6`
- **字体**：等宽字体（JetBrains Mono）展示数字/代码 + 无衬线（Inter）正文
- **动效**：数字 count-up、柱状图 grow、首 token 飞入动画（motion-principles）

### 5.2 页面结构（单页 + 锚点）

```
┌─────────────────────────────────────────────┐
│  顶栏：Coding Plan Bench · GLM-5.2 测速台      │
│  右侧：上次测速时间 + 「本地跑测速」按钮         │
├─────────────────────────────────────────────┤
│  🏆 概览卡：谁是速度之王                        │
│  ┌─────────┬─────────┬─────────┐            │
│  │ TTFT 最快 │ TPS 最高  │ 综合     │            │
│  │ 智谱 410ms│ 火山 92/s │ 火山     │            │
│  └─────────┴─────────┴─────────┘            │
├─────────────────────────────────────────────┤
│  📊 主对比：三柱图（TTFT / TPS / Total 切换）   │
│  ┌───────────────────────────────┐          │
│  │ 智谱  ████  410ms              │          │
│  │ 火山  ███   380ms  ← 最快      │          │
│  │ 百度  ██████ 720ms             │          │
│  └───────────────────────────────┘          │
├─────────────────────────────────────────────┤
│  📈 趋势：历史 TTFT/TPS 折线（多次测速累积）     │
├─────────────────────────────────────────────┤
│  📋 明细表：每家 × 每 prompt 的原始数据（可展开） │
├─────────────────────────────────────────────┤
│  ℹ️  方法论：测速公平性说明 + 环境元数据         │
└─────────────────────────────────────────────┘
```

### 5.3 用户操作流（顺畅优先）

**访客（看数据）**：
1. 打开 GitHub Pages 网站 → 直接看到最新一次测速结果
2. 点柱状图切换指标（TTFT/TPS/Total）
3. 看趋势图了解历史变化
4. 看方法论了解数据怎么来的

**自己（跑测速）**：
1. `git clone` + `cp .env.example .env` 填三家 key
2. `npm install && npm run bench` → 终端实时打印进度
3. `npm run dev` → 本地看结果 / `npm run deploy` 推 Pages
4.（可选）配 CI Secrets → 手动/定时跑

**关键 UX 细节**（遵 ui-ux-pro-max checklist）：
- 测速进行中：终端进度条 + 前端「数据生成中」骨架屏
- 无数据时（首次访问未跑 bench）：友好空状态 + 引导「如何跑第一次测速」
- 数据加载：骨架屏，避免内容跳动（content-jumping 规则）
- 暗色对比度 ≥ 4.5:1，焦点环可见，键盘可导航
- 响应式：375/768/1024/1440 四档

---

## 六、目录结构

```
coding-plan-bench/
├─ .env.example              # 三家 key 占位（ZAI_CODING_CN_API_KEY=...）
├─ .gitignore                # .env / node_modules / dist
├─ package.json              # scripts: bench / dev / build / deploy
├─ tsconfig.json
├─ vite.config.ts
├─ README.md                 # 项目说明 + 使用方法
├─ PLAN.md                   # 本文件
├─ bench/                    # 测速引擎（Node TS）
│  ├─ engine.ts              # fetch + SSE 流式计时
│  ├─ providers.ts           # 三家配置
│  ├─ prompts.ts             # 固定测试集
│  ├─ run.ts                 # 编排入口
│  └─ types.ts               # Result/Provider 类型（前后端共享）
├─ site/                     # 前端（Vite + React）
│  ├─ index.html
│  ├─ public/
│  │  └─ results.json        # 测速输出（引擎写，前端读）
│  ├─ src/
│  │  ├─ main.tsx
│  │  ├─ App.tsx
│  │  ├─ components/
│  │  │  ├─ OverviewCards.tsx     # 🏆 概览卡
│  │  │  ├─ ComparisonChart.tsx   # 📊 主对比柱图（自绘 SVG）
│  │  │  ├─ TrendChart.tsx        # 📈 历史折线
│  │  │  ├─ DetailTable.tsx       # 📋 明细表
│  │  │  └─ Methodology.tsx       # ℹ️ 方法论
│  │  ├─ lib/
│  │  │  ├─ fetchResults.ts       # 读 results.json
│  │  │  └─ format.ts             # 数字格式化
│  │  └─ styles/
│  │     └─ globals.css           # Tailwind 入口
│  └─ design-system/              # ui-ux-pro-max skill 生成的设计系统
│     └─ MASTER.md
└─ .github/
   └─ workflows/
      └─ bench.yml            # 可选 CI：手动/定时测速 + 部署
```

---

## 七、实施阶段（Stage 拆分）

> 每个 stage 完成后 commit，切换前 `git status` 确认干净。

### Stage 0：项目初始化（确认计划后）
- 建 GitHub 仓库 `TimeCraker/coding-plan-bench`（private 起步，纯静态前端，稳定后可 public）
- `git init` + 初始结构 + `.gitignore` + `package.json` + `tsconfig`
- 推 PLAN.md + README 占位
- commit: `chore: init project skeleton`

### Stage 1：测速引擎（核心，先跑通数据）
- `bench/types.ts` — 前后端共享类型
- `bench/providers.ts` — 三家配置（env 读 key）
- `bench/prompts.ts` — 6 条测试集
- `bench/engine.ts` — fetch + SSE 流式采 TTFT/TPS
- `bench/run.ts` — 串行编排 + 中位数汇总 + 写 `site/public/results.json`
- 跑 `npm run bench` 实测三家，确认数据正确
- commit: `feat(bench): 测速引擎 / benchmark engine`

### Stage 2：前端骨架 + 数据接入
- Vite + React + TS + Tailwind 初始化
- `fetchResults.ts` 读 results.json
- 跑 ui-ux-pro-max skill 生成 design-system/MASTER.md
- 概览卡 + 明细表（先静态展示，无动效）
- commit: `feat(site): 前端骨架 + 数据接入`

### Stage 3：可视化 + 动效
- 自绘 SVG 柱状对比图（Framer Motion grow 动效）
- 数字 count-up 动效
- 指标切换（TTFT/TPS/Total）交互
- commit: `feat(site): 对比图表 + 动效`

### Stage 4：趋势 + 体验打磨
- 历史趋势折线图（读多次 results 累积，或存 history.json）
- 空状态 / 骨架屏 / 响应式 / a11y 打磨
- 跑 design-audit skill 复查
- commit: `feat(site): 趋势图 + 体验打磨`

### Stage 5：部署 + CI（可选）
- GitHub Pages 部署（`npm run deploy` 或 Actions）
- 可选：bench.yml CI 手动/定时测速
- README 写使用文档
- commit: `ci: 部署 + 可选 CI 测速`

---

## 八、风险与注意事项

| 风险 | 应对 |
|------|------|
| **套餐额度消耗** | 测速每家每次 ~18 次调用，成本可控；CI 默认不开启定时，手动触发 |
| **Key 安全** | `.env` 入 `.gitignore`；CI 用 Secrets；前端永不接触 key |
| **CORS** | 测速走 Node 引擎非浏览器，规避 CORS；前端只读本地 JSON |
| **三家 model id 差异** | 已 curl 实测各家认的 id（智谱 glm-5.2 / 火山 glm-5.2[1m] / 百度 glm-5.2），记录在元数据 |
| **网络波动** | 每家每 prompt 跑 3 次取中位数；记录 runner 类型（local/CI）区分网络环境 |
| **thinking 参数差异** | 各家 thinking 行为不一（火山默认开、可关），测速时统一记录是否开 thinking，元数据透明 |

---

## 九、待用户确认的决策点

1. **项目名** `coding-plan-bench` 是否 OK？（备选 `glm-speed-dash` / `llm-race`）
2. **仓库可见性**：先 private 还是直接 public？（纯静态前端无敏感信息，public 可分享）
3. **CI 测速**：Stage 5 的 CI 要不要做？还是只做本地手动跑？
4. **测试 prompt 集**：用我预设的 6 条（代码生成/解释/补全），还是你有特定场景想加？
5. **设计风格**：暗色开发者仪表盘方向 OK？还是要亮色 / 其他风格？

---

> 确认以上后，我从 Stage 0 开始执行：建仓库 → 初始化 → 测速引擎 → 前端。
