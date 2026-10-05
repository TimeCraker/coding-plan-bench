// T-003 协议适配器测试：Anthropic / OpenAI SSE data → typed ProtocolEvent 归一化。
// 非法 JSON 必须抛稳定 protocol/parse 错误，不允许静默成功。
import { describe, expect, it } from "vitest";
import {
  ProtocolParseError,
  getProtocolAdapter,
  mapDataEvent,
} from "../../engine/protocols";
import {
  ANTHROPIC_EMPTY_STREAM,
  ANTHROPIC_STREAM,
  OPENAI_NO_USAGE_STREAM,
  OPENAI_STREAM,
} from "../fixtures/sse";
import { createSSEParser } from "../../engine/parse-sse";

function dataLines(stream: string): string[] {
  const p = createSSEParser();
  const out: string[] = [];
  for (const ev of p.push(stream)) out.push(ev.data);
  for (const ev of p.flush()) out.push(ev.data);
  return out;
}

describe("anthropic adapter", () => {
  const adapter = getProtocolAdapter("anthropic");

  it("完整流归一化为 reasoning/text/usage/finish", () => {
    const events = dataLines(ANTHROPIC_STREAM).flatMap((d) => adapter.mapDataEvent(d));
    const types = events.map((e) => e.type);
    expect(types).toContain("reasoning");
    expect(types).toContain("text");
    expect(types.filter((t) => t === "text")).toHaveLength(2);
    expect(types).toContain("usage");
    expect(types).toContain("finish");
  });

  it("message_start 的 usage 映射 inputTokens", () => {
    const events = adapter.mapDataEvent(
      '{"type":"message_start","message":{"usage":{"input_tokens":12,"output_tokens":1}}}',
    );
    expect(events).toEqual([
      { type: "usage", inputTokens: 12, outputTokens: 1 },
    ]);
  });

  it("message_delta 的最终 usage 覆盖初值，stop_reason 映射 finish", () => {
    const events = adapter.mapDataEvent(
      '{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":12,"output_tokens":96}}',
    );
    expect(events).toContainEqual({
      type: "usage",
      inputTokens: 12,
      outputTokens: 96,
    });
    expect(events).toContainEqual({ type: "finish", stopReason: "end_turn" });
  });

  it("text_delta 与 thinking_delta 分别映射", () => {
    expect(
      adapter.mapDataEvent(
        '{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}',
      ),
    ).toEqual([{ type: "text", text: "Hi" }]);
    expect(
      adapter.mapDataEvent(
        '{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"..."}}',
      ),
    ).toEqual([{ type: "reasoning", text: "..." }]);
  });

  it("空字符串 delta 不映射为 text（TTFT 只认非空正文）", () => {
    expect(
      adapter.mapDataEvent(
        '{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":""}}',
      ),
    ).toEqual([]);
  });

  it("未知合法事件（content_block_start/ping）返回空数组，不破坏后续", () => {
    expect(adapter.mapDataEvent('{"type":"content_block_start","index":0}')).toEqual([]);
    expect(adapter.mapDataEvent('{"type":"ping"}')).toEqual([]);
  });

  it("空流（无正文 delta）不产生 text/finish 之外的错误", () => {
    const events = dataLines(ANTHROPIC_EMPTY_STREAM).flatMap((d) =>
      adapter.mapDataEvent(d),
    );
    expect(events.some((e) => e.type === "text")).toBe(false);
  });

  it("流内 error 事件映射为稳定 error（只带类型，不透传上游 body）", () => {
    const events = adapter.mapDataEvent(
      '{"type":"error","error":{"type":"overloaded_error","message":"INTERNAL DETAILS"}}',
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "error", code: "unknown" });
    expect(JSON.stringify(events[0])).not.toContain("INTERNAL DETAILS");
  });
});

describe("openai adapter", () => {
  const adapter = getProtocolAdapter("openai");

  it("完整流：reasoning → text×2 → finish → usage；[DONE] 不产生事件", () => {
    const events = dataLines(OPENAI_STREAM).flatMap((d) => adapter.mapDataEvent(d));
    const types = events.map((e) => e.type);
    expect(types).toEqual([
      "reasoning",
      "text",
      "text",
      "finish",
      "usage",
    ]);
  });

  it("usage 映射 prompt_tokens/completion_tokens", () => {
    const events = adapter.mapDataEvent(
      '{"choices":[],"usage":{"prompt_tokens":9,"completion_tokens":42}}',
    );
    expect(events).toEqual([
      { type: "usage", inputTokens: 9, outputTokens: 42 },
    ]);
  });

  it("reasoning_content 与 content 分别映射", () => {
    expect(
      adapter.mapDataEvent(
        '{"choices":[{"index":0,"delta":{"reasoning_content":"th"}}]}',
      ),
    ).toEqual([{ type: "reasoning", text: "th" }]);
    expect(
      adapter.mapDataEvent('{"choices":[{"index":0,"delta":{"content":"x"}}]}'),
    ).toEqual([{ type: "text", text: "x" }]);
  });

  it("无 usage 的流不产生 usage 事件", () => {
    const events = dataLines(OPENAI_NO_USAGE_STREAM).flatMap((d) =>
      adapter.mapDataEvent(d),
    );
    expect(events.some((e) => e.type === "usage")).toBe(false);
  });

  it("finish_reason 映射 finish", () => {
    expect(
      adapter.mapDataEvent(
        '{"choices":[{"index":0,"delta":{},"finish_reason":"length"}]}',
      ),
    ).toEqual([{ type: "finish", stopReason: "length" }]);
  });
});

describe("非法 JSON", () => {
  it("抛 ProtocolParseError（code=protocol/parse），不静默成功", () => {
    expect(() => mapDataEvent("anthropic", "{not json")).toThrow(ProtocolParseError);
    try {
      mapDataEvent("openai", "{not json");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ProtocolParseError);
      expect((e as ProtocolParseError).code).toBe("protocol/parse");
    }
  });

  it("非对象 JSON（数字/数组/null）同样拒绝", () => {
    expect(() => mapDataEvent("anthropic", "42")).toThrow(ProtocolParseError);
    expect(() => mapDataEvent("openai", "null")).toThrow(ProtocolParseError);
  });
});
