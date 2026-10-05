// OpenAI Chat Completions SSE 事件适配器：
// delta.content / delta.reasoning_content（及 reasoning 变体）、finish_reason、
// stream_options.include_usage 的尾部 usage、流内 error。

import type { ProtocolEvent } from "../types";
import { parseEventJson, type ProtocolAdapter } from "./index";

function asRecord(x: unknown): Record<string, unknown> | null {
  if (x !== null && typeof x === "object" && !Array.isArray(x)) {
    return x as Record<string, unknown>;
  }
  return null;
}

export const openaiAdapter: ProtocolAdapter = {
  mapDataEvent(data: string): ProtocolEvent[] {
    if (data === "[DONE]") return [];

    const evt = parseEventJson(data);
    const out: ProtocolEvent[] = [];

    const usage = asRecord(evt.usage);
    if (usage) {
      const input = usage.prompt_tokens;
      const output = usage.completion_tokens;
      if (typeof input === "number" && typeof output === "number") {
        out.push({ type: "usage", inputTokens: input, outputTokens: output });
      }
    }

    const error = asRecord(evt.error);
    if (error) {
      const errorType =
        typeof error.type === "string" ? error.type : "unknown_error";
      // 只透传错误类型枚举，不回显上游 message body
      out.push({
        type: "error",
        code: "unknown",
        safeMessage: `上游流内错误：${errorType}`,
      });
      return out;
    }

    const choices = Array.isArray(evt.choices) ? evt.choices : [];
    const first = asRecord(choices[0]);
    if (first) {
      const delta = asRecord(first.delta);
      if (delta) {
        const content = delta.content;
        if (typeof content === "string" && content.length > 0) {
          out.push({ type: "text" });
        }
        const reasoning =
          delta.reasoning_content ?? delta.reasoning;
        if (typeof reasoning === "string" && reasoning.length > 0) {
          out.push({ type: "reasoning" });
        }
      }
      const finish = first.finish_reason;
      if (typeof finish === "string") {
        out.push({ type: "finish", stopReason: finish });
      }
    }

    return out;
  },
};
