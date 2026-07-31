# Coding Plan Bench 设计系统 · Master

> 由 ui-ux-pro-max skill `--design-system` 生成 + 项目定制。
> 亮色仪表盘方向，所有页面以本文件为准。

## 设计方向

**定位**：开发者数据仪表盘（dashboard），非 landing page。专业、克制、数据为先。
**风格**：Minimalism + 精致微动效。亮色优先（default light）。
**气质**：可信、清爽、前卫但不花哨——数据是主角，动效服务于理解。

## 色彩

| Token | 值 | 用途 |
|-------|-----|------|
| `--color-bg` | `#F8FAFC` (slate-50) | 页面背景 |
| `--color-surface` | `#FFFFFF` | 卡片/面板 |
| `--color-text` | `#1E293B` (slate-800) | 正文 |
| `--color-muted` | `#64748B` (slate-500) | 次要文本（≥4.5:1）|
| `--color-border` | `#E2E8F0` (slate-200) | 分隔线 |
| `--color-primary` | `#2563EB` (blue-600) | 主操作/链接 |
| `--color-primary-soft` | `#DBEAFE` (blue-100) | 高亮底 |
| `--color-cta` | `#F97316` (orange-500) | CTA/获胜标记 |

### 三家厂商数据色（图表用，色盲安全已考虑区分度）

| 厂商 | 色 | 值 |
|------|----|----|
| 智谱 GLM Coding Plan | 蓝紫 | `#6366F1` (indigo-500) |
| 火山方舟 Coding Plan | 橙 | `#F97316` (orange-500) |
| 百度千帆 Token Plan | 蓝 | `#3B82F6` (blue-500) |

> 火山橙与 CTA 橙重合：图表里火山用 `#EA580C` (orange-600) 加深，CTA 用 `#F97316`，避免视觉混淆。

## 字体

- **正文/UI**：Inter（无衬线，Clean）
- **数字/代码**：JetBrains Mono，`font-variant-numeric: tabular-nums`（防跳动）
- 行高：正文 1.6，数字 1.2
- 最小正文 16px，移动端不缩小

## 布局

- 容器 `max-w-6xl` 居中，移动端 `px-4`，桌面 `px-6`
- 卡片：`bg-surface rounded-2xl border border-border shadow-sm`
- 间距：4/8/12/16/24/32 等比 scale
- 响应式断点：375 / 768 / 1024 / 1440

## 动效规范（motion-principles）

| 场景 | 时长 | 缓动 |
|------|------|------|
| hover / focus | 100-150ms | ease-out |
| 指标切换 / tab | 200-250ms | `cubic-bezier(0.2,0,0,1)` |
| 数据入场（柱图 grow / 数字 count-up）| 400-600ms | ease-out / spring |
| 页面首屏编排 | 600ms 内完成 | stagger 60-80ms |

**铁律**：
- 只动画 `transform` / `opacity`，禁止 `width/height/top/left`
- 入场 `ease-out`，退场 `ease-in` 且更短更淡
- 退场不 scale 到 0，最小 0.95 + opacity
- `prefers-reduced-motion` 必须全量降级（已在 globals.css 处理）
- 频繁触发的动效越短越淡（hover 100ms opacity）

## 组件清单

| 组件 | 说明 |
|------|------|
| `StatCard` | 概览数字卡，count-up 动效 |
| `ComparisonBar` | 横向柱状对比，grow 动效，三家品牌色 |
| `MetricToggle` | TTFT/TPS/Total 切换，layout 动效（shared layoutId）|
| `TrendLine` | 历史折线，SVG 自绘 |
| `DetailTable` | 明细，可展开行 |
| `Skeleton` | 数据加载骨架屏 shimmer |

## 反模式（不做）

- ❌ emoji 当图标 → 用 Lucide SVG
- ❌ hover 用 scale 导致布局位移 → 用 color/shadow/translateY
- ❌ 亮色文字对比不足 → muted 最低 slate-500
- ❌ 数据加载无骨架 → 必须骨架屏
- ❌ 动效超 500ms 阻塞交互
