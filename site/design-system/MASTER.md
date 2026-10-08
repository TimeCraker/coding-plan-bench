# Coding Plan Bench 设计系统 · Master

> 单一事实源：组件只消费 `site/src/styles/globals.css` 的 token，禁止内联色值。
> v3（wave17 后）：Swiss Industrial Print · 减法与大白话基线。

## 设计方向

**定位**：开发者测速工具（仪表盘），非 landing page。专业、克制、**数据是英雄**。
**视觉世界**：Swiss Industrial Print——纸感底、墨色层级、单珊瑚强调、零圆角、发丝线、硬阴影。与 agent-hive（太木控制台）同源同语言。
**信息层级**：连接方式 → 测速表单 → 进度/结果 → 可比榜单 → 方法学。工具前置，无营销 Hero。
**文案基线（wave17）**：大白话——先讲本质区别再讲细节，每条一句话说清（`site/src/content/copy.ts` 单一事实源）。「连接方式 / 浏览器直连 / 中转代理 / 本地软件」。
**气质**：可信、清爽、纪律中带胆量——纪律让人尊敬，夸张让人记住（大数字戏剧化）。

## 色彩（globals.css @theme）

| Token | 值 | 用途 |
|-------|-----|------|
| `--color-paper` | `#F3F2ED` | 纸感底（body 点阵纹理 24px / α0.04） |
| `--color-panel` | `#FDFDFC` | 面板白 |
| `--color-panel-2` | `#F8F7F2` | 二级面板 / 头带 |
| `--color-ink` | `#1A1A18` | 油墨黑（正文/结构线） |
| `--color-ink-2` | `#5F5D55` | 次级墨（说明文字） |
| `--color-ink-3` | `#6F6B61` | 三级墨（mono 小标；纸底 4.7:1 AA） |
| `--color-line` | `#E4E3DA` | 发丝线（内部分区） |
| `--color-line-2` | `#D0CFC5` | 深发丝线（分隔/描边） |
| `--color-accent` | `#A8513C` | 珊瑚强调——**唯一强调色**（主站色板同源） |
| `--color-accent-deep` | `#8F4230` | 珊瑚 hover 深档 |
| `--color-accent-lift` | `#CC7D66` | 墨底亮珊瑚（ink 上 5.6:1，选中格内文本专用） |
| `--color-ok/run/warn/bad/mute` | `#2E7D46/#2D5A88/#A8761A/#C4341D/#8A8F98` | 状态语义色（数据语义，禁挪作装饰） |

> 硬阴影（offset print 阴影，无 blur 无发光）：`sm 2px2px0/α.12 · md 3px3px0/α.16 · lg 4px4px0/α.22`。

## 字体

- **正文/UI**：`--font-sans`（Segoe UI Variable Text + PingFang SC/雅黑）
- **展示标题**：`--font-disp`（Segoe UI Variable Display 栈；hero h1 30→44→52px，`tracking-[-0.035em]`）
- **数据/代号/时间**：`--font-mono`（JetBrains Mono 栈）+ `.tabular`（`font-variant-numeric: tabular-nums`）
- 纪律：mono 只用于数据/数字/代号/URL/时间；中文正文一律 sans

## 布局与制式

- `max-w-[1240px]` 单列 wrap（移动 16px / 桌面 36px 水平留白）
- **masthead**（珊瑚方标 + 字标堆叠 + mono 版号徽章列）→ **sticky 方框 segmented 导航** → 主体 → **colophon 页脚**
- **方框 segmented control**（全站切换器统一语言）：墨线外框 `border-[1.5px] border-ink` + 格间发丝分隔 + 选中格 `bg-ink text-paper`（格内珊瑚文本用 `accent-lift`）
- **编号区段制式**：主区块标题 `01 /` `02 /`…（mono 编号 `text-accent` + `.lbl-mono` 标题 + 发丝延伸线）
- 主面板 = `bg-panel` + `border-[1.5px] border-ink` + 硬阴影；次面板 = 发丝线无粗框
- 状态轨：行左 3-4px 语义色条；数据条：`h-[8px]` 归一化柱墙（#1 珊瑚，legacy 灰）
- 响应式 375/768/1024/1440；四断点 0 横滚；长文本 flex 子项 `min-w-0`；**连接卡文案禁止 truncate**（安全信息不可藏）

## 无障碍与触控基线

- 全局 `:focus-visible` 珊瑚环（2px + offset），键盘路径恒可见
- 移动端（<768）交互控件最小 44×44 CSS px；操作常显，禁止 hover-only
- 图标按钮必须有 accessible name；tab 组 `role=tablist/tab/aria-selected`；连接方式/协议用 `fieldset+legend` + radio
- 状态播报：进度 `role=status aria-live=polite`、错误 `role=alert`、consent `role=alert`
- 对比度：正文 ≥7:1、说明 ≥4.5:1；墨底珊瑚文本必须 `accent-lift`
- 组件不注入运行时 `<style>`（CSP 友好）

## 动效规范

- 时长 150–300ms；缓动 `var(--ease)` = `cubic-bezier(0.16,1,0.3,1)`
- 只动画 `transform` / `opacity` / color；禁止 `width/height/top/left`
- 入场 `anim-fade-up`（250ms）/ `anim-fade-in`（200ms）；数字滚动 count-up 600ms
- `prefers-reduced-motion` 全量降级（globals.css 全局覆盖）

## 组件清单（wave17 后实际）

| 组件 | 说明 |
|------|------|
| `Sidebar.tsx`（导出 `Masthead`） | masthead + sticky 方框 segmented 导航（测速台/能力榜） |
| `SecurityBanner` | 一行制安全提示（仅 bench 视图；下载本地版链接 + 关闭） |
| `TransportSelector` | 连接方式三并排方框卡（直连/中转/本地 + 下载前置） |
| `BenchForm` | 测速表单（编号区段 + 厂商分组芯片 + 协议分段 + 珊瑚 CTA） |
| `RunProgress` | consent 面板 + 分段进度条 + 取消 |
| `ResultCard` | 结果英雄卡（≥38px 三段统计带 + 单位上标 + 样本明细 mono 表） |
| `Leaderboard` | 可比榜单（行式列表 + 状态轨 + 2 层头部 + 示例区） |
| `GlobalLeaderboard` | 全球能力榜（方框 segmented 榜切换 + 柱状图墙 + 存置区分节 + 折叠来源） |
| `Methodology` | 方法学五方格 + 附录链接格（3×2） |

## 反模式（不做）

- ❌ 圆角（全站零圆角；唯一例外 = `pulse-dot` 圆点是 live 信号专用形）
- ❌ 渐变 / 玻璃拟态 / backdrop-blur / 发光阴影（硬阴影 offset 制）
- ❌ 第二强调色（蓝紫渐变 AI 风；nav 选中线一律珊瑚，语义蓝只做数据点）
- ❌ 图标库（lucide 已卸载；用几何方点 / mono 文字标签 / 状态色）
- ❌ 文字墙（成段说明 >2 行即拆方格/折叠；免责语每视图 ≤2 处）
- ❌ 截断藏安全信息（连接卡禁 truncate；数据列截断必须带 title）
- ❌ hover 用 scale 导致布局位移 → 用 color/border/translateY
- ❌ 动效超 500ms 阻塞交互
