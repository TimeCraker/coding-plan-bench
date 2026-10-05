// 协议适配器注册表：SSE data（原始字符串）→ typed ProtocolEvent。
// 分层契约：parser 只管帧，JSON 与厂商语义在这里归一化；非法 JSON 显式抛错。

import type { Protocol, ProtocolEvent } from "../types";
import { anthropicAdapter } from "./anthropic";
import { openaiAdapter } from "./openai";

export interface ProtocolAdapter {
  /** 一条 SSE data → 0..n 个语义事件；非法 JSON 抛 ProtocolParseError */
  mapDataEvent(data: string): ProtocolEvent[];
}

/** 稳定解析错误：code 固定 protocol/parse，消息不回显原始 data */
export class ProtocolParseError extends Error {
  readonly code = "protocol/parse" as const;

  constructor(cause?: unknown) {
    super("上游 SSE data 不是合法 JSON 对象（protocol/parse）");
    this.name = "ProtocolParseError";
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

/** 安全 JSON 解析：只接受对象，其他一律 ProtocolParseError */
export function parseEventJson(data: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch (e) {
    throw new ProtocolParseError(e);
  }
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    throw new ProtocolParseError();
  }
  return parsed as Record<string, unknown>;
}

const ADAPTERS: Record<Protocol, ProtocolAdapter> = {
  anthropic: anthropicAdapter,
  openai: openaiAdapter,
};

export function getProtocolAdapter(protocol: Protocol): ProtocolAdapter {
  return ADAPTERS[protocol];
}

/** 便捷入口：按协议映射一条 data */
export function mapDataEvent(
  protocol: Protocol,
  data: string,
): ProtocolEvent[] {
  return ADAPTERS[protocol].mapDataEvent(data);
}
