// 同构测速引擎类型定义（前端 + Worker + Node + Tauri 共用）

/** 协议类型：决定 SSE 解析方式 */
export type Protocol = "anthropic" | "openai";

/** 单次测速输入参数（运行时无关，key 由调用方传入） */
export interface BenchInput {
  endpoint: string; // 如 https://open.bigmodel.cn/api/anthropic
  apiKey: string;
  model: string; // 如 glm-5.2
  protocol: Protocol;
  prompt: string;
  maxTokens?: number; // 默认 512
  temperature?: number; // 默认 0
  timeoutMs?: number; // 默认 90000
}

/** 单次测速结果 */
export interface BenchResult {
  ttft: number; // ms, 首 token 延迟
  total: number; // ms, 总耗时
  outputTokens: number;
  inputTokens: number;
  text: string; // 正文输出（不含 thinking）
  thinkingMs: number; // 思考阶段耗时（0 表示无思考）
  success: boolean;
  error?: string;
}

/** 榜单记录（存 localStorage，不含 key） */
export interface LeaderboardEntry {
  id: string; // 唯一 id
  label: string; // 用户起的名字，如 "智谱 GLM-5.2"
  endpoint: string;
  model: string;
  protocol: Protocol;
  ttft: number; // 中位数
  tps: number;
  total: number;
  outputTokens: number;
  samples: number; // 取样次数
  ranAt: string; // ISO
}
