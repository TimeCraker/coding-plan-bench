// 全站文案单一事实源（AC-008）：每条对外承诺都必须映射到实现事实。
// 禁止无条件承诺（"任意模型 / Key 不上传 / 本机真实表现 / 终极判据"）。
// wave15 文案基线：说大白话——先讲本质区别，再讲细节；每条一句话说清。

import type { Protocol, RunStatus, TransportKind } from "../../../engine/types";

export const APP_TITLE = "可信测速台";

export const APP_SUBTITLE =
  "测三个数：首字等多久（TTFT）、每秒吐多少（TPS）、总共花多久（Total）。同一条件下测，成绩才能直接比。";

export const SECURITY_BANNER =
  "Key 只用来发这一次测速请求——去哪，由你在「连接方式」里的选择决定。";

export interface TransportCopy {
  label: string;
  keyPath: string;
  detail: string;
}

export const TRANSPORT_COPY: Record<TransportKind, TransportCopy> = {
  "browser-direct": {
    label: "浏览器直连",
    keyPath: "浏览器直接把 Key 发给模型官方，不经过我们的任何服务器。",
    detail: "最快最直接，先用它。个别厂商浏览器连不上时，再换下面两种。",
  },
  "trusted-proxy": {
    label: "中转代理",
    keyPath: "Key 经我们的一台转发器中转给官方：不存盘，但中转方看得到流量。",
    detail: "直连打不开时的兜底；只转发到受信任的官方地址，每次都要你确认。",
  },
  "tauri-local": {
    label: "本地软件",
    keyPath: "装个 Windows 小软件，Key 只在你电脑和模型官方之间。",
    detail: "最稳，什么都能测——浏览器打不开的也行。",
  },
};

export const LOCAL_APP_HINT =
  "不想让 Key 碰浏览器？装 Windows 本地版，Key 不离开你的电脑。";

export const LOCAL_APP_DOWNLOAD = "下载本地版";

export const CONSENT_TITLE = "确认走中转代理？";

export const CONSENT_BODY =
  "Key 会经我们的转发器中转（不存盘），但中转方看得到流量；只转发到官方厂商地址。想谁都不过——用本地软件。";

export const CONSENT_ACCEPT = "同意，走中转";
export const CONSENT_DECLINE = "取消";

export const URL_EXAMPLES: Record<Protocol, string> = {
  anthropic: "https://open.bigmodel.cn/api/anthropic/v1/messages",
  openai: "https://api.openai.com/v1/chat/completions",
};

export const URL_FIELD_HINT = "按你填的完整地址原样请求，不追加路径";

export const METRIC_COPY = {
  ttft: {
    label: "TTFT",
    unit: "ms",
    desc: "从发出请求到吐出第一个字，等多久。",
  },
  tps: {
    label: "TPS",
    unit: "tokens/s",
    desc: "每秒输出多少 token；官方没返回用量时不计入排名。",
  },
  total: {
    label: "Total",
    unit: "ms",
    desc: "从发出请求到全部输出完，总共多久。",
  },
} as const;

export const STATUS_COPY: Record<RunStatus, string> = {
  complete: "完整",
  partial: "部分成功",
  failed: "失败",
  cancelled: "已取消",
};

export const TOKEN_SOURCE_COPY: Record<string, string> = {
  provider: "用量来自官方返回",
  unavailable: "官方未返回用量，TPS 不计",
};

/** 稳定错误码 → 用户可执行建议 */
export const ERROR_ADVICE: Record<string, string> = {
  validation: "地址要完整 HTTPS（含路径），字段填全。",
  consent: "中转需先确认；或改用直连 / 本地软件。",
  "cors/network": "浏览器连不上官方。换本地软件，或确认后走中转。",
  auth: "Key 无效或没有该模型权限。",
  "rate-limit": "官方限流，稍后再试或减少取样。",
  timeout: "超时。查网络后重试，或减少取样。",
  "protocol/parse": "返回数据解析失败：协议选错或地址不符。",
  "empty-output": "官方返回了空结果，已记失败，可重试。",
  "usage-unavailable": "官方没返回用量，TPS 不可用。",
  cancelled: "已取消本次测试。",
  "proxy-policy": "目标不在受信名单。改用直连或本地软件。",
  unknown: "未知错误。可复制诊断信息后重试。",
};

export const FOOTER_BENCH =
  "不同连接方式 / profile 的成绩不直接可比；数据只存在你的浏览器里。";

// ── 榜单分享与趋势（wave22 功能文案）──
export const BOARD_VIEW_LIST = "榜单";
export const BOARD_VIEW_TREND = "趋势";
export const BOARD_SHARE = "复制榜单";
export const BOARD_SHARE_DONE = "已复制，去粘贴分享";
export const TREND_TITLE = "趋势速览";
export const TREND_EMPTY = "同一模型测 2 次以上，这里会出现它的历史曲线。";
export const TREND_SAMPLES = "次";

export const METHODOLOGY_TITLE = "方法学与口径";

export const METHODOLOGY_POINTS = [
  "同一把尺子：固定题目（cpb-standard@1）、温度 0、上限 1024——条件随成绩一起记录，可追溯。",
  "TTFT：发出请求 → 吐出第一个字的等待；模型的思考时间不计入。",
  "TPS：每秒输出多少 token，逐次测、取中位；官方没给用量就不算。",
  "Total：从发请求到全部输出完；完整 / 部分成功 / 失败 / 已取消分开记，部分成功不进排名。",
  "成绩只存在你自己的浏览器里；不同连接方式不可直接比。",
];

export const DIAGNOSTICS_TITLE = "诊断信息（可复制，不含 Key）";
