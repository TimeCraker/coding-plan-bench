// 全站文案单一事实源（AC-008）：每条对外承诺都必须映射到实现事实。
// 禁止无条件承诺（"任意模型 / Key 不上传 / 本机真实表现 / 终极判据"）。

import type { Protocol, RunStatus, TransportKind } from "../../../engine/types";

export const APP_TITLE = "Coding Plan Bench · 可信测速台";

export const APP_SUBTITLE =
  "在明确的执行位置与一致的测试 profile 下测量 TTFT / TPS / Total。支持 Anthropic / OpenAI 双协议兼容服务。";

export const SECURITY_BANNER =
  "Key 仅用于本次测速请求：去向取决于你在「执行位置」中的选择（浏览器直连 / 项目代理 / 本地 App），切换选项可查看每种路径的具体说明。";

export interface TransportCopy {
  label: string;
  keyPath: string;
  detail: string;
}

export const TRANSPORT_COPY: Record<TransportKind, TransportCopy> = {
  "browser-direct": {
    label: "浏览器直连",
    keyPath:
      "请求由你的浏览器直接发往模型厂商，不经项目服务器；Key 只存在于浏览器内存与发往厂商的请求中。",
    detail:
      "最直接的路径。部分厂商未开放浏览器 CORS，直连失败时可换用本地 App 或（仅受信上游）项目代理。",
  },
  "trusted-proxy": {
    label: "项目代理（需当次确认）",
    keyPath:
      "Key 会经项目 Worker 内存转发到目标厂商，不会写入应用存储；项目服务运营方与平台仍属于传输链路。仅支持受信上游列表内的目标。",
    detail:
      "代理不追随重定向、只访问受信 HTTPS 上游；用于厂商不开 CORS 时的兜底，每次使用都需要你当次确认。",
  },
  "tauri-local": {
    label: "本地 App（Windows）",
    keyPath:
      "请求由本地 App 直接发往模型厂商，Key 全程留在你的设备与厂商之间，不经过任何项目服务器。",
    detail:
      "Windows 本地版内嵌同一份测速引擎，无需远端代理即可完成 1/3/5 次取样与取消。",
  },
};

export const LOCAL_APP_HINT =
  "想要完全不经过浏览器的链路？下载 Windows 本地 App（tauri-local 执行位置），Key 不离开你的设备。";

export const CONSENT_TITLE = "使用项目代理前的确认";

export const CONSENT_BODY =
  "选择「同意」后：Key 会经项目 Worker 内存转发、不会写入应用存储，但服务运营方 / 平台仍属于传输链路。代理只访问受信上游列表中的 HTTPS 目标，不追随重定向。";

export const CONSENT_ACCEPT = "同意并使用项目代理";
export const CONSENT_DECLINE = "取消";

export const URL_EXAMPLES: Record<Protocol, string> = {
  anthropic: "https://open.bigmodel.cn/api/anthropic/v1/messages",
  openai: "https://api.openai.com/v1/chat/completions",
};

export const URL_FIELD_HINT =
  "协议切换时给出完整示例；系统按你填写的完整地址原样请求，不追加路径";

export const METRIC_COPY = {
  ttft: {
    label: "TTFT",
    unit: "ms",
    desc: "请求发出到第一个非空可见正文 delta 的时间；思考（reasoning）不计入。",
  },
  tps: {
    label: "TPS",
    unit: "tokens/s",
    desc: "上游 usage 返回的输出 token 数 ÷ 正文生成区间；逐样本计算后取中位数。上游未返回 usage 时不参与 TPS 排名。",
  },
  total: {
    label: "Total",
    unit: "ms",
    desc: "请求发出到流结束的端到端耗时。它是完整度参量之一，不是唯一的「终极判据」。",
  },
} as const;

export const STATUS_COPY: Record<RunStatus, string> = {
  complete: "完整",
  partial: "部分成功",
  failed: "失败",
  cancelled: "已取消",
};

export const TOKEN_SOURCE_COPY: Record<string, string> = {
  provider: "token 用量来自上游 usage",
  unavailable: "上游未返回 usage，不参与 TPS 排名",
};

/** 稳定错误码 → 用户可执行建议 */
export const ERROR_ADVICE: Record<string, string> = {
  validation: "检查 Request URL 是否为完整 HTTPS 地址（含协议路径），以及字段是否填写完整。",
  consent: "使用项目代理需要当次确认；也可以改用浏览器直连或本地 App。",
  "cors/network": "浏览器直连被厂商 CORS 或网络拦截。可检查 URL、下载本地 App，或（仅受信上游）确认后使用项目代理。",
  auth: "凭证被上游拒绝。检查 API Key 是否有效、是否有对应模型权限。",
  "rate-limit": "上游限流。稍后再试或降低取样次数。",
  timeout: "请求超过时间上限。检查网络后重试，或减少取样次数。",
  "protocol/parse": "上游返回的数据无法按所选协议解析。确认协议类型与接口地址匹配。",
  "empty-output": "上游返回了空流（无正文）。该样本已记为失败，可重试。",
  "usage-unavailable": "上游未返回 token usage，TPS 不可用。",
  cancelled: "已取消本次测试。",
  "proxy-policy": "目标被代理策略拒绝（不在受信列表 / 重定向 / 私网地址）。使用浏览器直连或本地 App。",
  unknown: "未知错误。可复制诊断信息后重试。",
};

export const FOOTER_BENCH =
  "结果取决于所选执行位置的网络路径与测试 profile；跨 transport / profile 的数据不直接可比。";

export const METHODOLOGY_TITLE = "方法学与口径";

export const METHODOLOGY_POINTS = [
  "测试 prompt 来自版本化 profile（cpb-standard@1），温度 0、max_tokens 1024；每条结果记录 profile 与测量版本，可追溯测试条件。",
  "TTFT = 请求发出 → 第一个非空可见正文 delta；思考阶段（reasoning）单独计量，不计入 TTFT。",
  "TPS = 上游 usage 的输出 token ÷ 正文生成区间，逐样本计算后取中位数；上游未返回 usage 时 TPS 为空且不参与排名。",
  "Total = 请求发出 → 流结束。完整（全部样本成功）/ 部分成功 / 失败 / 已取消 四态分开呈现，部分成功不进入默认排名。",
  "榜单数据仅保存在你的浏览器 localStorage；不同执行位置（浏览器 / 代理 / 本地 App）的网络路径不同，跨条件比较需显式切换分组。",
];

export const DIAGNOSTICS_TITLE = "诊断信息（可复制，不含 Key）";
