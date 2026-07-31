# Coding Plan Bench

> 模型测速台 · 填入任意模型的 endpoint + key，测 **TTFT / TPS / Total**，榜单对比排名

支持 Anthropic 兼容 与 OpenAI 兼容 双协议，覆盖智谱、火山、百度、OpenAI、DeepSeek、Claude 等绝大多数模型厂商。

🌐 **[在线使用](https://coding-plan-bench.pages.dev/)** ｜ 💻 **[下载 Windows 本地版](https://github.com/TimeCraker/coding-plan-bench/releases)**

---

## 三端架构

一份 TypeScript 测速引擎，三个运行出口，**同一份核心代码**：

```
                    ┌─────────────────────────┐
                    │  engine/ (同构 TS 引擎)   │
                    │  发请求 → SSE 流式        │
                    │  → 采集 TTFT/TPS/Total   │
                    └────────────┬────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
   🌐 网站前端              ☁️ Worker 代理            💻 本地 App
   (Cloudflare Pages)      (Cloudflare Workers)      (Tauri · Windows)
   浏览器直调优先            CORS 失败时兜底           key 全程本地
   开 CORS 的不经服务器      key 用完即弃              绝不出门
```

| 端 | 地址 | 作用 | Key 去向 |
|----|------|------|---------|
| 🌐 **网站前端** | [coding-plan-bench.pages.dev](https://coding-plan-bench.pages.dev/) | 用户界面 + 浏览器直调测速 | 开 CORS 的：不出浏览器；否则走 Worker |
| ☁️ **Worker API** | coding-plan-bench-api.timecraker-ace.workers.dev | CORS 兜底测速代理 | 用完即弃，不存储不 log |
| 💻 **本地 App** | [Releases](https://github.com/TimeCraker/coding-plan-bench/releases) | Windows 桌面版 | 全程在用户电脑 |

**测速链路**：浏览器直调优先（快、不经服务器）→ CORS 失败自动回退 Worker（保证都能测）。

---

## 使用方式

### 🌐 在线用（推荐，零门槛）

打开 [coding-plan-bench.pages.dev](https://coding-plan-bench.pages.dev/) → 填表单 → 点测速 → 看榜单。

首次访问预置了三家 GLM-5.2 示例数据，可直接看对比效果；测自己的会加入榜单一起排名。

### 💻 下载本地版（Key 最安全）

去 [Releases](https://github.com/TimeCraker/coding-plan-bench/releases/latest) 下载 Windows 包：

- `coding-plan-bench_x.x.x_x64-setup.exe` — 安装程序
- `coding-plan-bench_x.x.x_x64_en-US.msi` — MSI 安装包

双击安装 → 开始菜单打开 → 填表单测速。**无需装 Rust / Node**，安装包已含运行时，Key 全程在你自己电脑。

---

## 测什么

| 指标 | 含义 | 判据 |
|------|------|------|
| **TTFT** | 首 token 延迟（ms）— 响应快慢 | 越低越好 ↓ |
| **TPS** | tokens/秒 — 输出效率 | 越高越好 ↑ |
| **Total** | 总耗时（ms）— 端到端完成 | 越低越好 ↓（终极判据） |

榜单支持按三个指标各自排名切换。多次取样取中位数，排除网络抖动。

---

## 安全

- 🔑 **Key 不存储不上传**：仅用于本次测速请求，响应结束即丢弃
- 📋 **localStorage 只存指标**（TTFT/TPS/Total + endpoint + model），**绝不存 Key**
- 🏠 **本地版 Key 全程在用户电脑**
- 🔓 **Worker / 服务器代码开源可审计**（本仓库 `server/` + `src/worker.ts`）

---

## 本地开发

```bash
git clone https://github.com/TimeCraker/coding-plan-bench.git
cd coding-plan-bench
npm install
```

### 常用命令

```bash
npm run dev        # 前端开发 (http://localhost:5173)
npm run build      # 构建前端到 site/dist
npm run server     # 起 Node 后端 API (localhost:8787, 可选, 浏览器直调失败时回退)
npm run tauri dev  # Tauri 本地 App 开发 (需 Rust + MSVC Build Tools)
npm run tauri build # 打包 Windows 安装包
```

开发时前端通过 Vite proxy 把 `/api` 转发到 `localhost:8787`（见 `vite.config.ts`）。

### 自部署后端（替代 Worker）

如果你有自己的服务器，可以用同一份 Hono 代码部署：

```bash
npm run build              # 构建前端
node --import tsx server/node.ts   # 起后端 (或编译后 node server/node.js)
```

前端通过环境变量 `VITE_API_BASE` 指向你的后端：

```bash
VITE_API_BASE=https://your-server.com/api npm run build
```

---

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 前端 | Vite 7 · React 19 · TypeScript 5.7 · Tailwind CSS v4 · Framer Motion | 亮/暗双主题，自绘 SVG 图表 |
| 引擎 | TypeScript（同构） | 一份代码跑三处，零运行时依赖 |
| 后端 | Hono | 同构 Cloudflare Worker + Node |
| 本地 App | Tauri 2 | Windows，复用前端 |
| CI/CD | GitHub Actions | 前端自动部署 + Windows 包构建 |

## 项目结构

```
coding-plan-bench/
├─ engine/            # 同构测速引擎 (三端共用)
│  ├─ bench.ts        # 核心: 发请求 → SSE → 采集 TTFT/TPS/Total
│  ├─ parse-sse.ts    # SSE 流解析
│  └─ types.ts        # 共享类型
├─ server/            # Hono 后端 (同构 Worker + Node)
│  ├─ index.ts        # POST /api/bench
│  └─ node.ts         # Node 运行时入口
├─ src/worker.ts      # Cloudflare Worker 入口
├─ site/              # 前端 (Vite + React)
│  ├─ src/
│  │  ├─ components/  # BenchForm / Leaderboard / ResultCard ...
│  │  ├─ lib/         # api / storage / theme / format
│  │  └─ styles/      # Tailwind + 主题变量
│  └─ public/
├─ src-tauri/         # Tauri 本地 App (Rust 壳)
├─ .github/workflows/ # CI: 部署前端 + 构建 Windows 包
└─ wrangler.toml      # Cloudflare Worker 配置
```

---

## 部署

### 网站前端（Cloudflare Pages，主）

```bash
VITE_API_BASE=https://coding-plan-bench-api.timecraker-ace.workers.dev/api \
  npm run build
npx wrangler pages deploy site/dist --project-name=coding-plan-bench --branch=main
```

### Worker API（Cloudflare Workers）

```bash
npx wrangler deploy     # 部署 src/worker.ts
```

### Windows 本地包（GitHub Actions）

手动触发 [Build Windows App](https://github.com/TimeCraker/coding-plan-bench/actions/workflows/build-windows.yml) workflow，输入 tag（如 `v0.1.0`），自动构建并发到 Releases。

---

## License

MIT
