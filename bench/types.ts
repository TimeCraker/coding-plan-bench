// Coding Plan Bench — 前后端共享类型定义
// 引擎写入 results.json，前端读取；本文件是契约。

export type ProviderId = "zhipu" | "volcengine" | "baidu";

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  endpoint: string;
  model: string;
  envVar: string;
  /** 品牌色 hex（与 design-system 一致） */
  color: string;
}

/** 单次测速原始记录 */
export interface Sample {
  provider: ProviderId;
  promptId: string;
  run: number; // 1..N
  ttft: number; // ms, 首 token 延迟
  tps: number; // tokens/s, 输出速度
  total: number; // ms, 总耗时
  outputTokens: number;
  inputTokens: number;
  success: boolean;
  error?: string;
}

/** 每家汇总（中位数） */
export interface ProviderSummary {
  provider: ProviderId;
  ttftMedian: number;
  tpsMedian: number;
  totalMedian: number;
  /** 在多少个 prompt 上是该家最快 */
  wins: number;
  successRate: number;
}

export interface BenchMeta {
  ranAt: string; // ISO
  runner: "local" | "ci";
  node: string;
  samples: number; // 每个 prompt×provider 跑几次
}

export interface BenchResult {
  meta: BenchMeta;
  providers: ProviderConfig[];
  prompts: { id: string; label: string; category: string }[];
  samples: Sample[];
  summary: ProviderSummary[];
}

/** 历史趋势点（多次测速累积） */
export interface HistoryPoint {
  ranAt: string;
  summaries: ProviderSummary[];
}
