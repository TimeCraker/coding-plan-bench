// Anthropic Messages SSE 事件适配器：
// message_start/message_delta 的 usage、text_delta/thinking_delta、stop_reason、流内 error。

import type { ProtocolEvent } from "../types";
import { parseEventJson, type ProtocolAdapter } from "./index";

function asRecord(x: unknown): Record<string, unknown> | null {
  if (x !== null && typeof x === "object" && !Array.isArray(x)) {
    return x as Record<string, unknown>;
  }
  return null;
}

/** usage 对象 → usage 事件（字段缺失则跳过） */
function usageEvents(u: Record<string, unknown>): ProtocolEvent[] {
  const input = u.input_tokens;
  const output = u.output_tokens;
  if (typeof input !== "number" || typeof output !== "number") return [];
  return [{ type: "usage", inputTokens: input, outputTokens: output }];
}

export const anthropicAdapter: ProtocolAdapter = {
  mapDataEvent(data: string): ProtocolEvent[] {
    const evt = parseEventJson(data);
    const type = typeof evt.type === "string" ? evt.type : undefined;

    if (type === "message_start") {
      const message = asRecord(evt.message);
      const usage = message ? asRecord(message.usage) : null;
      return usage ? usageEvents(usage) : [];
    }

    if (type === "message_delta") {
      const out: ProtocolEvent[] = [];
      const usage = asRecord(evt.usage);
      if (usage) out.push(...usageEvents(usage));
      const delta = asRecord(evt.delta);
      const stop = delta ? delta.stop_reason : undefined;
      if (typeof stop === "string") out.push({ type: "finish", stopReason: stop });
      return out;
    }

    if (type === "content_block_delta") {
      const delta = asRecord(evt.delta);
      if (!delta) return [];
      const text = delta.text;
      if (typeof text === "string" && text.length > 0) {
        return [{ type: "text", text }];
      }
      const thinking = delta.thinking;
      if (typeof thinking === "string" && thinking.length > 0) {
        return [{ type: "reasoning", text: thinking }];
      }
      return [];
    }

    if (type === "error") {
      const error = asRecord(evt.error);
      const errorType =
        error && typeof error.type === "string" ? error.type : "unknown_error";
      // 只透传错误类型枚举，不回显上游 message body
      return [
        {
          type: "error",
          code: "unknown",
          safeMessage: `上游流内错误：${errorType}`,
        },
      ];
    }

    // message_stop / content_block_start / content_block_stop / ping 等合法事件：
    // 对计量无贡献，忽略（未知字段不破坏后续事件）
    return [];
  },
};
