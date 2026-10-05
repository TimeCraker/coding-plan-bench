// 同构测速引擎类型定义（前端 + Worker + Node + Tauri 共用）
//
// 本文件是 S01 冻结的领域契约（Spec §3.3）：
// - schema v2：结果与榜单都携带 provenance（profile / measurement / transport / token source）
// - 指标 null 语义：缺数据就是 null，禁止用 0 / 字符估算伪装
// - API Key 不属于任何可持久化类型

// ───────────────────────── 基础枚举 ─────────────────────────

/** 协议类型：决定 SSE 事件语义映射 */
export type Protocol = "anthropic" | "openai";

/** 显式执行位置（FR-001）：用户选择，samples 不得改变它 */
export type TransportKind = "browser-direct" | "trusted-proxy" | "tauri-local";

/** 多样本运行状态（FR-005）：complete=全部成功；partial=部分成功；failed=0 成功；cancelled=用户取消 */
export type RunStatus = "complete" | "partial" | "failed" | "cancelled";

/** 单样本状态 */
export type SampleStatus = "complete" | "failed" | "cancelled";

/** token 数据来源（FR-004）：只有 provider usage 才可排名 TPS */
export type TokenSource = "provider" | "unavailable";

/** 稳定错误码（Spec §4.5 固定集合，禁止自由字符串） */
export type BenchErrorCode =
  | "validation"
  | "consent"
  | "cors/network"
  | "auth"
  | "rate-limit"
  | "timeout"
  | "protocol/parse"
  | "empty-output"
  | "usage-unavailable"
  | "cancelled"
  | "proxy-policy"
  | "unknown";

// ───────────────────────── 版本常量 ─────────────────────────

export const SCHEMA_VERSION = 2 as const;
export const MEASUREMENT_VERSION = 1 as const;

/** 允许的取样次数（Spec §4.2：samples 仅 1/3/5） */
export const SAMPLE_COUNTS = [1, 3, 5] as const;
export type SampleCount = (typeof SAMPLE_COUNTS)[number];

export function isSampleCount(n: number): n is SampleCount {
  return (SAMPLE_COUNTS as readonly number[]).includes(n);
}

// ───────────────────────── Benchmark Profile（FR-003） ─────────────────────────

/** 版本化测速 profile：可复现测试条件的单一事实源 */
export interface BenchmarkProfile {
  id: string;
  version: number;
  prompt: string;
  /** prompt 的 sha256(hex)，锁定测试内容 */
  promptSha256: string;
  maxTokens: number;
  temperature: number;
  /** 单样本墙钟上限 ms */
  timeoutMs: number;
}

// ───────────────────────── typed protocol events（T-003 适配器输出） ─────────────────────────

/**
 * 协议适配器归一化后的事件。时间戳由 measurement reducer 在消费时注入
 * （事件本身纯语义，便于 fixture 锁定）。
 * text/reasoning 携带可选 payload：计量层忽略（只看时间戳），
 * CLI 兼容层用它累积正文；payload 不进入任何可持久化结果。
 */
export type ProtocolEvent =
  | { type: "reasoning"; text?: string }
  | { type: "text"; text?: string }
  | { type: "usage"; inputTokens: number; outputTokens: number }
  | { type: "finish"; stopReason: string }
  | { type: "error"; code: BenchErrorCode; safeMessage: string };

/** 带到达时间戳的事件（reducer 输入） */
export interface TimedProtocolEvent {
  at: number;
  event: ProtocolEvent;
}

// ───────────────────────── 结果对象（Spec §3.3） ─────────────────────────

/** 单样本结果：一切指标 null 表示"未测得"，绝不用 0 伪装 */
export interface SampleResult {
  status: SampleStatus;
  /** 首 token 延迟：请求开始到第一个非空可见正文 delta；无正文为 null */
  ttftMs: number | null;
  /** 思考耗时：仅 reasoning 出现且随后有正文时存在 */
  thinkingMs: number | null;
  /** 正文生成区间：firstText → lastText */
  generationMs: number | null;
  /** 总耗时：请求开始 → 流结束（任何状态都有） */
  totalMs: number;
  outputTokens: number | null;
  inputTokens: number | null;
  /** 逐样本 TPS = outputTokens / generationMs；任一缺失为 null */
  tps: number | null;
  tokenSource: TokenSource;
  error?: { code: string; safeMessage: string };
}

/** 聚合指标：成功样本逐指标中位数（TPS 逐样本计算后再取中位数） */
export type AggregateMetrics = Omit<SampleResult, "status" | "error">;

/** 一次多样本运行的可序列化结果 */
export interface BenchmarkRunResult {
  schemaVersion: 2;
  measurementVersion: 1;
  profile: { id: string; version: number; promptSha256: string };
  transport: TransportKind;
  status: RunStatus;
  requestedSamples: 1 | 3 | 5;
  successCount: number;
  aggregate: AggregateMetrics;
  samples: SampleResult[];
}

// ───────────────────────── 榜单条目 v2（FR-008 / T-008 使用） ─────────────────────────

/**
 * 可比较榜单条目：组合 run 的 provenance + 用户标注。
 * 保存前必须把 Request URL 规范化为 origin + pathname（不存 query / credentials）。
 * v1 迁移记录（legacy）不携带 run：transport/profile/tokenSource 未知即不推断，
 * 原始数值保留在 legacyMetrics 中仅供查看，永不参与排名。
 */
export interface LeaderboardEntryV2 {
  schemaVersion: 2;
  id: string;
  label: string;
  protocol: Protocol;
  /** 规范化展示用 URL：origin + pathname，无 query 无凭证 */
  requestUrlDisplay: string;
  model: string;
  ranAt: string;
  run?: BenchmarkRunResult;
  /** v1 迁移记录：无 provenance，永不参与排名 */
  legacy?: true;
  /** 是否可进入默认比较视图（legacy / partial / demo 为 false） */
  rankable: boolean;
  /** 示例数据（独立分区展示） */
  demo?: true;
  /** 仅 legacy：v1 原始数值（不可排名） */
  legacyMetrics?: {
    ttft: number;
    tps: number;
    total: number;
    outputTokens: number;
    samples: number;
  };
}

// ───────────────────────── 不变量校验（纯函数） ─────────────────────────

/** 指标值合法：非 null、finite、≥ 0 */
export function isSampleMetricValid(n: number | null): boolean {
  return n !== null && Number.isFinite(n) && n >= 0;
}

/**
 * 校验 SampleResult 不变量，返回违规字段名列表（空 = 合法）。
 * NFR-002：不出现负耗时、NaN、Infinity 或无正文 complete。
 */
export function sampleInvariants(s: SampleResult): string[] {
  const violations: string[] = [];

  if (!Number.isFinite(s.totalMs) || s.totalMs < 0) violations.push("totalMs");

  for (const key of ["ttftMs", "thinkingMs", "generationMs"] as const) {
    const v = s[key];
    if (v !== null && (!Number.isFinite(v) || v < 0)) violations.push(key);
  }
  if (
    s.ttftMs !== null &&
    Number.isFinite(s.ttftMs) &&
    s.ttftMs > s.totalMs
  ) {
    if (!violations.includes("ttftMs")) violations.push("ttftMs");
  }

  for (const key of ["outputTokens", "inputTokens"] as const) {
    const v = s[key];
    if (v !== null && (!Number.isFinite(v) || v < 0)) violations.push(key);
  }

  if (s.tps !== null && (!Number.isFinite(s.tps) || s.tps <= 0)) {
    violations.push("tps");
  }
  if (s.tps !== null && s.outputTokens === null) {
    violations.push("tps-requires-tokens");
  }

  if (s.status === "complete" && s.ttftMs === null) {
    violations.push("status-requires-ttft");
  }

  if (
    s.status !== "complete" &&
    s.status !== "failed" &&
    s.status !== "cancelled"
  ) {
    violations.push("status");
  }

  if (s.error !== undefined) {
    if (
      typeof s.error.code !== "string" ||
      typeof s.error.safeMessage !== "string"
    ) {
      violations.push("error");
    }
  }

  return violations;
}

// ───────────────────────── legacy v1 类型（T-004 / T-008 移除） ─────────────────────────

/**
 * @deprecated v1 遗留：仅供旧 bench 流程与 v1 localStorage 数据迁移使用。
 * 新代码禁止构造；T-008 迁移后从存储层淘汰。
 */

/** 单次测速输入参数（运行时无关，key 由调用方传入） */
export interface BenchInput {
  endpoint: string;
  apiKey: string;
  model: string;
  protocol: Protocol;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

/** v1 单次测速结果（success 布尔语义，S01 起废弃） */
export interface BenchResult {
  ttft: number;
  total: number;
  outputTokens: number;
  inputTokens: number;
  text: string;
  thinkingMs: number;
  stopReason?: string;
  success: boolean;
  error?: string;
}

/** @deprecated v1 榜单记录（无 provenance） */
export interface LeaderboardEntry {
  id: string;
  label: string;
  endpoint: string;
  model: string;
  protocol: Protocol;
  ttft: number;
  tps: number;
  total: number;
  outputTokens: number;
  samples: number;
  ranAt: string;
}
