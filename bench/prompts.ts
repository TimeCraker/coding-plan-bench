// 固定测试集：6 条 prompt，覆盖代码生成 / 代码解释 / 补全三类编码场景
// 所有 prompt 走相同 max_tokens / temperature，保证三家公平

export interface BenchPrompt {
  id: string;
  label: string;
  category: "code-gen" | "code-explain" | "complete";
  content: string;
}

export const PROMPTS: BenchPrompt[] = [
  {
    id: "code-gen-1",
    label: "实现快速排序",
    category: "code-gen",
    content: "用 TypeScript 实现一个快速排序函数，要求支持泛型比较器，并写出完整类型签名。只输出代码，不要解释。",
  },
  {
    id: "code-gen-2",
    label: "防抖节流",
    category: "code-gen",
    content: "用 JavaScript 实现 debounce 和 throttle 两个函数，包含完整注释。只输出代码。",
  },
  {
    id: "code-explain-1",
    label: "解释闭包",
    category: "code-explain",
    content: "用 3 句话解释 JavaScript 闭包的原理，并给出一个最小可运行示例。",
  },
  {
    id: "code-explain-2",
    label: "解释事件循环",
    category: "code-explain",
    content: "解释 Node.js 事件循环的宏任务与微任务执行顺序，200 字以内。",
  },
  {
    id: "complete-1",
    label: "补全 React 组件",
    category: "complete",
    content: "补全以下 React 组件，实现一个带防抖的受控输入框：\n\nfunction DebouncedInput() {\n  // TODO\n}\n\n只输出完整代码。",
  },
  {
    id: "complete-2",
    label: "补全 SQL 查询",
    category: "complete",
    content: "补全 SQL：查询每个部门薪资最高的 3 名员工。假设有 employees(id, name, dept, salary) 表。只输出 SQL。",
  },
];

/** 测速统一参数 */
export const BENCH_PARAMS = {
  maxTokens: 512,
  temperature: 0,
  samples: 3, // 每个 prompt × provider 跑几次，取中位数
} as const;
