# Coding Plan Bench · v2 实施计划

> 状态：**待用户确认后开干**
> 定位：公开测速工具——网站在线用 + 本地下载用，一份引擎代码两形态
> 日期：2026-07-31

## 一、最终技术栈

| 层 | 选型 | 理由 |
|----|------|------|
| 前端 | React 19 + TS + Tailwind v4 + Framer Motion + Lucide | 复用 v1，轻量现代 |
| 测速引擎 | **TypeScript 同构**（engine/）| 一份代码跑三处 |
| 网站后端 | **Hono**（同构框架）| 一份代码跑 Node 服务器 + Cloudflare Worker |
| 本地 App | **Tauri 2 + Node sidecar** | 复用 TS 引擎，跨平台，key 不出门 |
| 存储 | localStorage（榜单）| 不存 key，零数据库 |
| 部署 | GitHub Pages（前端）+ Cloudflare Worker（主）+ 自服务器（备选）| 全免费/低成本 |

**流量策略**：浏览器直调优先（CORS 开的直连，降 70% 流量）→ CORS 失败走 Worker → 超额引导下本地版 / 升 Worker 付费。服务器代码备好手动启用，不自动兜底。

## 二、架构图

```
┌────────────── 一份 TS 测速引擎 (engine/bench.ts) ──────────────┐
│   发请求 → SSE 流式 → 采集 TTFT/TPS/Total（与运行时无关）       │
└────────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
  ┌──────────┐        ┌──────────────┐    ┌──────────────┐
  │ Tauri App│        │ Hono @Worker │    │ Hono @Node   │
  │ (本地下载)│        │ (网站主,边缘) │    │ (服务器备选)  │
  │ Node     │        │ 浏览器直调优先 │    │ 手动启用      │
  │ sidecar  │        │ CORS 失败回退 │    │              │
  └──────────┘        └──────────────┘    └──────────────┘
        ▲                    ▲                    ▲
        └──── 同一个 React 前端调 POST /api/bench ─┘
                   （前端不关心背后是谁）
```

## 三、目录结构

```
coding-plan-bench/
├─ engine/                    # 同构测速引擎（核心，三形态共用）
│  ├─ bench.ts                # bench(url,key,model,proto) → 指标
│  ├─ parse-sse.ts            # SSE 解析（Anthropic + OpenAI 两协议）
│  └─ types.ts                # 共享类型
├─ server/                    # Hono 后端（同构：Worker + Node）
│  ├─ index.ts                # POST /api/bench → 调 engine
│  └─ wrangler.toml           # Cloudflare Worker 配置
├─ src-tauri/                 # Tauri 本地 App 壳
│  ├─ Cargo.toml
│  └─ src/main.rs             # Rust 胶水：起 Node sidecar 跑 engine
├─ site/                      # 前端（两形态共用）
│  ├─ index.html
│  ├─ public/
│  │  └─ results.json         # v1 示例数据（默认展示）
│  └─ src/
│     ├─ App.tsx
│     ├─ components/
│     │  ├─ BenchForm.tsx     # 输入表单（协议/URL/Key/Model/取样）
│     │  ├─ Leaderboard.tsx   # 榜单（三指标排名）
│     │  ├─ ResultCard.tsx    # 单次结果卡
│     │  ├─ OverviewCards.tsx # v1 复用
│     │  ├─ ComparisonChart.tsx # v1 复用
│     │  └─ SecurityBanner.tsx # key 安全提示
│     ├─ lib/
│     │  ├─ api.ts            # 调 /api/bench（带 CORS 回退）
│     │  ├─ storage.ts        # localStorage 榜单（不存 key）
│     │  └─ format.ts         # v1 复用
│     └─ design-system/MASTER.md
└─ package.json
```

## 四、UI/UX 设计（调用前端 skill）

### 4.1 设计系统生成（ui-ux-pro-max skill）

启动时跑 design-system 搜索锁定风格，并 `--persist` 落地到 `design-system/MASTER.md`：
```bash
python3 ui-ux-pro-max/scripts/search.py \
  "developer benchmark dashboard light professional modern minimal premium" \
  --design-system --persist -p "Coding Plan Bench"
```

**预设方向**（亮色，前卫专业）：
- 背景 `#F8FAFC` + 卡片 `#FFFFFF` + 主色蓝 `#2563EB`
- Inter 正文 + JetBrains Mono 数字（tabular-nums）
- 三家品牌色保留，但用户自测模型用**动态分配色**（HSL 轮转，避免撞色）
- 微妙渐变 + 精致阴影（elevation）+ glassmorphism 顶栏

### 4.2 动效规范（motion-principles + framer-motion skill）

| 场景 | 实现 | 时长/缓动 |
|------|------|----------|
| 卡片入场 | variants + staggerChildren | 400ms ease-out, stagger 60ms |
| 榜单排序变化 | `layout` 动画（位置平滑过渡）| spring stiffness 400 damping 32 |
| 指标切换 | `layoutId` shared 高亮 | spring |
| 数字 | count-up（useMotionValue + useTransform）| 600ms ease-out |
| 测速中 | 流式 token 飞入 + 进度脉冲 | 实时 |
| 结果出现 | AnimatePresence mode="wait" | 300ms |
| 列表删除 | AnimatePresence + layout="popLayout" | 200ms ease-in |

**铁律**（motion-principles）：
- 只动画 transform/opacity，禁止 width/height/top/left
- 入场 ease-out，退场 ease-in 且更短更淡
- 退场不 scale 到 0（最小 0.95）
- `prefers-reduced-motion` 全量降级（globals.css 已处理）
- 频繁触发的越短越淡

### 4.3 交付前审查（design-audit skill）

Stage 收尾跑 design-audit 的 grep 检查清单：
- conditional render 必包 AnimatePresence
- hover 必有 transition
- 列表 .map 必 stagger
- 无 clickable div（用 button/role）
- outline:none 必配 :focus-visible
- 时长/缓动 ≤ 5 种（一致性）
- 动画 aria-hidden

### 4.4 关键 UX 流程（符合用户使用逻辑）

**主流程：测一个模型**
1. 进首页 → 顶部安全提示条（key 不存储）+ 输入表单
2. 填：协议（Anthropic/OpenAI 下拉）+ Endpoint URL + API Key（密码框）+ Model + 取样次数（默认 3）
3. 点「开始测速」→ 按钮变 loading（禁用 + spinner）→ 实时显示「正在调用...」
4. 结果卡飞入（TTFT/TPS/Total count-up）+ 自动加入下方榜单
5. 榜单按当前选中指标排序，新结果高亮 2 秒

**对比流程：测多个比排名**
1. 榜单区顶部：三指标 tab（TTFT/TPS/Total），切换榜单排序
2. 每条记录：模型名 + endpoint + 三个指标 + 时间戳 + 删除按钮
3. 榜单存 localStorage，刷新不丢
4. 「清空全部」二次确认

**安全分支：用户担心 key**
1. 顶部安全提示条带「了解本地版」链接
2. 跳转下载页（GitHub Releases）：Win/Mac/Linux 三平台包
3. 本地版界面与网站一致，但测速走本地 Node，key 不出门

**错误处理**
- key 无效（401）→ 红色提示「API Key 无效，请检查」
- endpoint 不通 → 「无法连接，检查 URL」
- CORS 失败回退 Worker → 静默切换，用户无感
- 超时（90s）→ 「请求超时」

## 五、实施阶段（Stage 拆分）

每个 Stage 完成后 commit + push。

### Stage 1：同构引擎抽取
- 把 v1 `bench/engine.ts` 重构为 `engine/bench.ts`（与运行时无关）
- 抽 `parse-sse.ts`，支持 Anthropic + OpenAI 两种协议
- `engine/types.ts` 共享类型
- 单元自测：Node 直接调三家验证

### Stage 2：Hono 后端（Worker + Node 同构）
- `server/index.ts`：Hono app，`POST /api/bench` 调 engine
- `wrangler.toml`：Worker 配置
- 本地 `wrangler dev` 测通
- `node server/index.ts` 也能跑（同构验证）
- commit

### Stage 3：前端表单 + API 层
- `BenchForm.tsx`：协议/URL/Key/Model/取样 输入
- `lib/api.ts`：调 /api/bench，带「浏览器直调优先 → Worker 回退」逻辑
- `SecurityBanner.tsx`：顶部安全提示
- 跑 ui-ux-pro-max skill 生成 design-system/MASTER.md
- commit

### Stage 4：榜单 + localStorage
- `Leaderboard.tsx`：三指标 tab + 排序 + layout 动画
- `lib/storage.ts`：localStorage 增删查（不存 key）
- `ResultCard.tsx`：单结果卡 + count-up
- 删除/清空（AnimatePresence + 二次确认）
- commit

### Stage 5：动效打磨 + design-audit
- 入场编排（variants stagger）
- 榜单排序 layout 动画
- 指标切换 layoutId
- 数字 count-up
- 跑 design-audit skill 全套 grep 检查，修 critical 项
- 跨断点响应式（375/768/1024/1440）
- commit

### Stage 6：Tauri 本地版
- `src-tauri/` 初始化 + Node sidecar 配置
- Rust main.rs：起 sidecar 跑 engine，暴露 /api/bench 给前端
- 前端检测 Tauri 环境，API 指向本地 sidecar
- `tauri build` 出 Win/Mac/Linux 包
- commit

### Stage 7：部署 + 文档
- GitHub Pages 部署前端
- Cloudflare Worker 部署后端（`wrangler deploy`）
- README：在线用 + 下载用 双文档
- GitHub Releases 上传本地包
- 服务器备选部署说明（手动 `node server`）

## 六、安全模型（贯穿始终）

- 用户 key **只用于本次测速请求**，不存储不 log
- localStorage 只存指标 + endpoint + model，**绝不存 key**
- UI 顶部常驻安全提示
- Worker/服务器代码开源可审计
- 本地版 key 全程在用户电脑

## 七、待确认

1. 技术栈（Hono 同构 + Tauri + Worker 主 + 浏览器直调优先）认可？
2. 七个 Stage 的拆分 OK？要不要先做到 Stage 5（网站完整）再做 Tauri？
3. Tauri 本地版要 Win/Mac/Linux 三平台，还是先只出 Windows（你主力机）？
4. 设计方向：亮色专业仪表盘 + 前卫微动效，认可？
