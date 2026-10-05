// glm-5.3 世代对比用例集：4 条编码用例，刻意避开"太简单拉不开差距"的题
// 覆盖 生成（中难/高难）/ 改错 / 解释 四类；每条附评分要点（rubric）供人工粗评
// thinking 模型思考要占 max_tokens 预算，统一放宽到 4096 防截断

export interface BenchCase {
  id: string;
  label: string;
  category: "gen" | "fix" | "explain";
  /** 难度：mid 能拉开档位，hard 拉大差距 */
  level: "mid" | "hard";
  /** 本用例 max_tokens（覆盖全局默认；thinking 占预算，难题需更大余量防截断） */
  maxTokens?: number;
  content: string;
  /** 人工粗评要点（写入结果文档） */
  rubric: string[];
}

export const BENCH_PARAMS = {
  maxTokens: 4096, // 全局默认（含 thinking 预算；v1 用 512 导致大量截断样本）
  temperature: 0,
  samples: 2, // 每用例 × 模型跑几次（时延取中位数，质量看首跑）
  timeoutMs: 300_000, // thinking 模型端到端可能超 90s
  delayMs: 2_000, // 相邻请求间隔（智谱频控）
  retryDelayMs: 5_000, // 失败重试前等待
} as const;

export const CASES: BenchCase[] = [
  {
    id: "gen-lru",
    label: "生成 LRU 缓存",
    category: "gen",
    level: "mid",
    content:
      "用 TypeScript 实现一个 LRU 缓存类 LRUCache：构造函数传入 capacity；get(key) 命中返回 value 并把该键提升为最近使用，未命中返回 undefined；put(key, value) 写入，超容量时淘汰最久未使用项；get/put 均要求 O(1)。只输出代码，不要解释。",
    rubric: [
      "基于 Map + delete/set 技巧实现 O(1)，而非数组遍历找 LRU",
      "get 命中后正确提升新鲜度（delete 再 set）",
      "put 超容量先淘汰 Map 第一个键（最旧）",
      "类型签名完整（泛型 K/V 或等价）",
    ],
  },
  {
    id: "gen-emitter",
    label: "生成类型安全事件总线",
    category: "gen",
    level: "hard",
    maxTokens: 6144, // 首轮实测 flash 在 4096 下思考吃满预算、正文为空
    content:
      "用 TypeScript 实现类型安全的事件总线 EventEmitter<Events extends Record<string, unknown[]>>：on<K>(key, fn) 的回调参数类型由 Events[K] 推导；off 取消订阅；emit<K>(key, ...args) 按事件名约束参数。附一个定义 { ping: [number]; data: [string, boolean] } 的最小用法示例。只输出代码。",
    rubric: [
      "泛型约束正确（Events extends Record<string, unknown[]> 等价形式均可）",
      "on/emit 的 K 联动推导正确（fn: (...args: Events[K]) => void）",
      "off 支持按函数引用移除且不炸未注册的",
      "用法示例能通过严格模式类型检查（概念上）",
    ],
  },
  {
    id: "fix-intervals",
    label: "改错 合并区间",
    category: "fix",
    level: "mid",
    maxTokens: 8192, // 首轮实测两模型均在 4096 下思考吃满预算、正文为空
    content:
      "下面的 mergeIntervals 有 bug（不止一个）。请找出所有 bug，说明每个的触发场景，并给出修正后的完整代码。\n\n```ts\nfunction mergeIntervals(intervals: number[][]): number[][] {\n  const sorted = intervals.sort((a, b) => a[0] - b[0]);\n  const out: number[][] = [sorted[0]];\n  for (let i = 1; i < sorted.length; i++) {\n    const last = out[out.length - 1];\n    const cur = sorted[i];\n    if (cur[0] < last[1]) {\n      last[1] = cur[1];\n    } else {\n      out.push(cur);\n    }\n  }\n  return out;\n}\n```",
    rubric: [
      "找出 bug①：cur[0] < last[1] 应为 <=，相邻区间 [1,2],[2,3] 该合却没合",
      "找出 bug②：last[1] = cur[1] 应为 Math.max(last[1], cur[1])，嵌套区间 [1,10],[2,3] 会把右端点改小",
      "两个 bug 都给出触发场景（不只是改对代码）",
      "修正代码完整可运行、无新引入问题",
    ],
  },
  {
    id: "explain-eventloop",
    label: "解释 事件循环输出",
    category: "explain",
    level: "mid",
    content:
      "写出下面代码的精确输出顺序（逐行列出），并用两三句话解释为什么：\n\n```js\nconsole.log('1');\nsetTimeout(() => console.log('2'), 0);\nPromise.resolve().then(() => {\n  console.log('3');\n  setTimeout(() => console.log('4'), 0);\n});\nqueueMicrotask(() => console.log('5'));\n(async () => {\n  console.log('6');\n  await null;\n  console.log('7');\n})();\nconsole.log('8');\n```",
    rubric: [
      "输出顺序完全正确：1 6 8 3 5 7 2 4",
      "解释到位：同步代码先跑完，微任务队列（then/queueMicrotask/await 续体）当轮清空后才跑宏任务",
      "能指出 4 排在 2 之后的原因（3 里注册的 setTimeout 排到 2 后面）",
    ],
  },
];
