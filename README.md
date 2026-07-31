# Coding Plan Bench

> GLM-5.2 订阅套餐测速台 · 对比智谱 / 火山方舟 / 百度千帆的响应速度与 token 输出效率

同样问 GLM-5.2，哪家套餐的 token 出得快、首响应来得早？本工具用真实 API 流式调用采集 **TTFT（首 token 延迟）** 与 **TPS（token/秒）**，给出可复现的对比。

## 被测对象

| 厂商 | 套餐 | Endpoint | model |
|------|------|----------|-------|
| 智谱 | GLM Coding Plan | `open.bigmodel.cn/api/anthropic` | `glm-5.2` |
| 火山方舟 | Ark Coding Plan | `ark.cn-beijing.volces.com/api/coding` | `glm-5.2[1m]` |
| 百度千帆 | Qianfan Token Plan | `qianfan.baidubce.com/anthropic/tokenplan/personal` | `glm-5.2` |

三家均为 Anthropic 兼容协议，测速引擎用同一套请求代码，只切 endpoint/key/model，保证公平。

## 快速开始

```bash
# 1. 装依赖
npm install

# 2. 配 key
cp .env.example .env
#   填入 ZAI_CODING_CN_API_KEY / VOLCENGINE_CODING_API_KEY / QIANFAN_API_KEY

# 3. 跑测速（串行，约 1-2 分钟，消耗少量套餐额度）
npm run bench

# 4. 看结果
npm run dev          # 本地前端展示
#   或 npm run build && npm run preview
```

测速结果写入 `site/public/results.json`，前端读取后可视化。

## 测速指标

| 指标 | 含义 |
|------|------|
| **TTFT** | 首 token 延迟（ms）—「响应快慢」|
| **TPS** | tokens/秒 —「输出效率」|
| **Total** | 总耗时（ms）|
| **Success** | 成功率 |

公平性：固定 6 条编码 prompt、`max_tokens=512`/`temperature=0`、串行不并发、每家每 prompt 跑 3 次取中位数、流式采集首 token。

## 架构

```
bench/   Node 测速引擎（带 key 调 API，流式计时）→ results.json
site/    Vite + React + TS + Tailwind v4 + Framer Motion 静态前端
```

纯静态前端（部署 GitHub Pages），不接触 API key；测速由本地 Node 脚本完成。

## 技术栈

Vite 7 · React 19 · TypeScript 5.7 · Tailwind CSS v4 · Framer Motion · Lucide · 自绘 SVG 图表

## 设计

亮色仪表盘，参照 `site/design-system/MASTER.md`（由 ui-ux-pro-max skill 生成）。
