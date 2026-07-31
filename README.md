# Coding Plan Bench

> 模型测速台 · 填入任意模型的 endpoint + key，测 TTFT / TPS / Total，榜单对比排名

在线用（网站）或下载本地版（key 不出门），两种方式都支持。

## 两种使用方式

### 🌐 在线用

打开网站 → 填表单 → 测速 → 看榜单。

- 开了 CORS 的模型（智谱 / 火山 / OpenAI 等）浏览器直连，key 不经服务器
- 没开 CORS 的（百度等）走 Cloudflare Worker 代理，key 用完即弃不存储

### 💻 下载本地版（更安全）

去 [Releases](https://github.com/TimeCraker/coding-plan-bench/releases) 下载 Windows 包，双击运行。key 全程在你自己电脑，绝不出门。

## 测什么

| 指标 | 含义 |
|------|------|
| **TTFT** | 首 token 延迟（ms）— 响应快慢 |
| **TPS** | tokens/秒 — 输出效率 |
| **Total** | 总耗时（ms）— 端到端，终极判据 |

支持 Anthropic 兼容 和 OpenAI 兼容 两种协议，覆盖绝大多数模型厂商。

## 本地开发

```bash
npm install
cp .env.example .env   # 仅自部署后端时需要

# 前端
npm run dev

# 后端 API（可选，浏览器直调失败时回退）
npx tsx server/node.ts

# 构建
npm run build

# Tauri 本地 App（需 Rust + MSVC Build Tools）
npx tauri build
```

## 架构

一份 TypeScript 测速引擎，三个出口：

```
engine/ (同构 TS) ── 网站浏览器直调（CORS 开的）
                 ── Cloudflare Worker / 自部署 Hono（CORS 兜底）
                 ── Tauri 本地 App
```

- **前端**：Vite + React 19 + TS + Tailwind v4 + Framer Motion
- **后端**：Hono（同构 Cloudflare Worker + Node）
- **本地 App**：Tauri 2（Windows）
- **存储**：localStorage 榜单（不存 key）

## 安全

- API Key 仅用于本次测速，不存储不上传，请求结束即丢弃
- localStorage 只存指标 + endpoint + model，绝不存 key
- 本地版 key 全程在用户电脑
- Worker / 服务器代码开源可审计

## 部署

- 前端：GitHub Pages（自动部署，push main 触发）
- Windows 包：GitHub Actions 构建发 Releases（手动 / release 触发）
- Worker：`npx wrangler deploy`（可选）
