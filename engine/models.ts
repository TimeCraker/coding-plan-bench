// 模型矩阵：多模型对比台的单一事实源
// 网站快选预设（BenchForm）与 bench runner（bench/run.ts）共用
// key 一律经 envVar 由进程环境注入，绝不写入代码 / 结果 / 提交
// 2026-10-06 依 BMI 调研更新：新增 5 渠道项，端点与模型 ID 均经各厂官方文档核验

import type { Protocol } from "./types";

export interface ModelTarget {
  id: string; // 唯一 id（runner 样本关联用）
  name: string; // 展示名（网站预设 / 结果表）
  endpoint: string; // API 基础地址（不含 /v1/... 后缀）
  model: string; // 模型 ID
  protocol: Protocol;
  envVar: string; // API key 环境变量（runner 读取；网站预设不涉及）
  color: string; // 品牌色 hex（与 design-system 一致）
  era: "glm-5.3" | "glm-5.2"; // 世代：5.3 为现行矩阵，5.2 为 v1 存量渠道
  note?: string; // 补充说明（如未实测标记）
}

/** glm-5.3 世代现行矩阵 + v1 存量渠道（env 无 key 时 runner 自动跳过） */
export const MODEL_MATRIX: ModelTarget[] = [
  // ── glm-5.3 世代：智谱同一把 key，旗舰 vs flash vs flashx（标称 200 tps 加速档） ──
  {
    id: "zhipu-glm53",
    name: "智谱 GLM-5.3",
    endpoint: "https://open.bigmodel.cn/api/anthropic",
    model: "glm-5.3",
    protocol: "anthropic",
    envVar: "ZHIPU_API_KEY",
    color: "#6366F1",
    era: "glm-5.3",
  },
  {
    id: "zhipu-glm53-flash",
    name: "智谱 GLM-5.3-Flash",
    endpoint: "https://open.bigmodel.cn/api/anthropic",
    model: "glm-5.3-flash",
    protocol: "anthropic",
    envVar: "ZHIPU_API_KEY",
    color: "#10B981",
    era: "glm-5.3",
  },
  {
    id: "zhipu-glm53-flashx",
    name: "智谱 GLM-5.3-FlashX",
    endpoint: "https://open.bigmodel.cn/api/anthropic",
    model: "glm-5.3-flashx",
    protocol: "anthropic",
    envVar: "ZHIPU_API_KEY",
    color: "#F59E0B",
    era: "glm-5.3",
  },
  // ── glm-5.3 世代：方舟 Coding Plan（2026-08-14 上线 glm-5.3） ──
  {
    id: "volcengine-glm53",
    name: "火山方舟 GLM-5.3",
    endpoint: "https://ark.cn-beijing.volces.com/api/coding",
    model: "glm-5.3[1m]",
    protocol: "anthropic",
    envVar: "VOLCENGINE_CODING_API_KEY",
    color: "#FB923C",
    era: "glm-5.3",
  },
  // ── glm-5.3 世代：千帆 Token Plan（glm-5.3 + DeepSeek-V4.1-Flash） ──
  {
    id: "baidu-glm53",
    name: "百度千帆 GLM-5.3",
    endpoint: "https://qianfan.baidubce.com/anthropic/tokenplan/personal",
    model: "glm-5.3",
    protocol: "anthropic",
    envVar: "QIANFAN_API_KEY",
    color: "#60A5FA",
    era: "glm-5.3",
  },
  {
    id: "baidu-deepseek-v41-flash",
    name: "百度 DeepSeek-V4.1-Flash",
    endpoint: "https://qianfan.baidubce.com/anthropic/tokenplan/personal",
    model: "deepseek-v4.1-flash",
    protocol: "anthropic",
    envVar: "QIANFAN_API_KEY",
    color: "#4D6BFE",
    era: "glm-5.3",
    note: "千帆侧确认在线（2026-09-16 文档）；官方 Anthropic 渠道见新增项 deepseek-flash",
  },
  // ── glm-5.3 世代：官方直连渠道（DeepSeek / Kimi，Anthropic 兼容端点已核官方文档） ──
  {
    id: "deepseek-flash",
    name: "DeepSeek V4.1-Flash（官方）",
    endpoint: "https://api.deepseek.com/anthropic",
    model: "deepseek-flash",
    protocol: "anthropic",
    envVar: "DEEPSEEK_API_KEY",
    color: "#2563EB",
    era: "glm-5.3",
    note: "官方 Anthropic 兼容渠道；峰谷计价",
  },
  {
    id: "moonshot-kimi-k3",
    name: "Kimi K3",
    endpoint: "https://api.moonshot.ai/anthropic",
    model: "kimi-k3",
    protocol: "anthropic",
    envVar: "KIMI_API_KEY",
    color: "#8B5CF6",
    era: "glm-5.3",
    note: "官方 Anthropic 兼容渠道；未实测",
  },
  // ── glm-5.2 存量：v1 三渠道（2026-07-31 实测过，见 site/public/results.json） ──
  {
    id: "zhipu-glm52",
    name: "智谱 GLM-5.2",
    endpoint: "https://open.bigmodel.cn/api/anthropic",
    model: "glm-5.2",
    protocol: "anthropic",
    envVar: "ZAI_CODING_CN_API_KEY",
    color: "#818CF8",
    era: "glm-5.2",
  },
  {
    id: "volcengine-glm52",
    name: "火山方舟 GLM-5.2",
    endpoint: "https://ark.cn-beijing.volces.com/api/coding",
    model: "glm-5.2[1m]",
    protocol: "anthropic",
    envVar: "VOLCENGINE_CODING_API_KEY",
    color: "#EA580C",
    era: "glm-5.2",
    note: "方舟已上 glm-5.3[1m]，此项保留作 v1 存量对照",
  },
  {
    id: "baidu-glm52",
    name: "百度千帆 GLM-5.2",
    endpoint: "https://qianfan.baidubce.com/anthropic/tokenplan/personal",
    model: "glm-5.2",
    protocol: "anthropic",
    envVar: "QIANFAN_API_KEY",
    color: "#3B82F6",
    era: "glm-5.2",
  },
];
