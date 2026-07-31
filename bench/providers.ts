import type { ProviderConfig } from "./types";

// 三家厂商配置：base_url / env / model / 品牌色
// model id 已 curl 实测各家 endpoint 认可的值：
//   智谱 anthropic 认 glm-5.2（不认 [1m]）
//   火山 /api/coding 认 glm-5.2[1m]（也认 glm-5.2，[1m] 启用 1M）
//   百度千帆 认 glm-5.2
export const PROVIDERS: ProviderConfig[] = [
  {
    id: "zhipu",
    name: "智谱 GLM Coding Plan",
    endpoint: "https://open.bigmodel.cn/api/anthropic",
    model: "glm-5.2",
    envVar: "ZAI_CODING_CN_API_KEY",
    color: "#6366F1",
  },
  {
    id: "volcengine",
    name: "火山方舟 Ark Coding Plan",
    endpoint: "https://ark.cn-beijing.volces.com/api/coding",
    model: "glm-5.2[1m]",
    envVar: "VOLCENGINE_CODING_API_KEY",
    color: "#EA580C",
  },
  {
    id: "baidu",
    name: "百度千帆 Qianfan Token Plan",
    endpoint: "https://qianfan.baidubce.com/anthropic/tokenplan/personal",
    model: "glm-5.2",
    envVar: "QIANFAN_API_KEY",
    color: "#3B82F6",
  },
];
