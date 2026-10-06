# Coding Plan Bench 设计系统 · Master

> 由 ui-ux-pro-max skill `--design-system` 生成 + 项目定制。
> 亮色仪表盘方向，所有页面以本文件为准。
> S01（T-009）更新：token 与实现同步、无障碍与触控基线纳入规范。

## 设计方向

**定位**：开发者数据仪表盘（dashboard），非 landing page。专业、克制、数据为先。
**信息层级（S01 冻结）**：信任/执行位置 → 输入表单 → 进度/结果 → 可比榜单 → 方法学。紧凑工作台，工具前置，无营销大 Hero。
**风格**：Minimalism + 精致微动效。亮色优先（default light），无保存偏好时跟随系统 `prefers-color-scheme`（首帧由 `public/theme-boot.js` 设置，无闪烁）。
**气质**：可信、清爽、前卫但不花哨——数据是主角，动效服务于理解。

## 色彩

| Token | 值 | 用途 |
|-------|-----|------|
| `--color-bg` | `#F8FAFC` (slate-50) | 页面背景 |
| `--color-surface` | `#FFFFFF` | 卡片/面板 |
| `--color-text` | `#1E293B` (slate-800) | 正文 |
| `--color-muted` | `#3F4857` | 次要文本（10–11px 小字实测 ≥4.5:1，axe color-contrast 0 违规）|
| `--color-border` | `#E2E8F0` (slate-200) | 分隔线 |
| `--color-primary` | `#2563EB` (blue-600) | 主操作/链接 |
| `--color-primary-soft` | `#DBEAFE` (blue-100) | 高亮底 |
| `--color-cta` | `#F97316` (orange-500) | CTA/获胜标记 |

> 对比度基线（T-009）：小号徽章/元信息用 `var(--text)` 或加深后的 muted；禁止 `emerald/blue/purple-600` 直接放白底（改 700 档）。

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
- 根布局 `flex flex-col md:flex-row`：移动端 Sidebar 堆叠在顶部（不得与主区水平并排挤压）
- 卡片：`bg-surface rounded-2xl border border-border shadow-sm`
- 间距：4/8/12/16/24/32 等比 scale
- 响应式断点：375 / 768 / 1024 / 1440；四断点页面级 0 横向滚动（e2e 机械验证）
- 长文本行内的 flex 子项必须 `min-w-0`；可能溢出的控件行用「可访问横向滚动」（`w-full overflow-x-auto` 容器）

## 无障碍与触控基线（T-009）

- 全局 `:focus-visible` 双环（2px primary + offset），键盘路径恒可见
- 移动端（<768）交互控件最小 44×44 CSS px；删除等操作常显，禁止 hover-only
- 图标按钮必须有 accessible name（aria-label）；tab 组用 `role=tablist/tab/aria-selected`；协议/执行位置用 `fieldset+legend` + radio
- 状态播报：进度 `role=status aria-live=polite`、错误 `role=alert`、consent `role=alert`
- 组件不注入运行时 `<style>`（CSP 友好），样式全部静态 Tailwind utility

## 动效规范（motion-principles）

| 场景 | 时长 | 缓动 |
|------|------|------|
| hover / focus | 100-150ms | ease-out |
| 指标切换 / tab | 200-250ms | `cubic-bezier(0.2,0,0,1)` |
| 数据入场（柱图 grow / 数字 count-up）| 400-600ms | ease-out |
| 页面首屏编排 | 600ms 内完成 | stagger 60-80ms |

> 动效实现（T-011 起）：framer-motion 依赖已整体移除，入场/循环动画均为纯 CSS
> （globals.css `anim-fade-up` / `anim-fade-in` / 背景循环工具类；tab 选中态为
> active class + transition），`prefers-reduced-motion` 由全局 CSS 覆盖停用。

**铁律**：
- 只动画 `transform` / `opacity`，禁止 `width/height/top/left`
- 入场 `ease-out`，退场 `ease-in` 且更短更淡
- 退场不 scale 到 0，最小 0.95 + opacity
- `prefers-reduced-motion` 必须全量降级（已在 globals.css 处理）
- 频繁触发的动效越短越淡（hover 100ms opacity）

## 组件清单（S01 重构后实际组件）

| 组件 | 说明 |
|------|------|
| `Sidebar` | 侧边栏导航（测速台 / 全球能力榜视图切换） |
| `SecurityBanner` | 常驻安全与信任提示 |
| `TransportSelector` | 执行位置选择（fieldset + radio） |
| `BenchForm` | 测速输入表单（协议 / 完整 Request URL / Key / 取样次数 / 快选芯片） |
| `RunProgress` | consent 面板 + 样本进度 + 取消 |
| `ResultCard` | 单次结果卡（transport / profile / 完整状态 / token 来源） |
| `Leaderboard` | 可比榜单（指标 tablist，active class + transition） |
| `GlobalLeaderboard` | 全球模型能力榜（静态数据，内置 `Skeleton` 骨架屏） |
| `Methodology` | 方法学与口径说明 |

## 反模式（不做）

- ❌ emoji 当图标 → 用 Lucide SVG
- ❌ hover 用 scale 导致布局位移 → 用 color/shadow/translateY
- ❌ 亮色文字对比不足 → muted 最低 slate-500
- ❌ 数据加载无骨架 → 必须骨架屏
- ❌ 动效超 500ms 阻塞交互
