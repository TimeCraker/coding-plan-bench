// T-004 单样本计量测试：时间线语义（AC-001 核心）。
// 用显式时间戳注入锁死：TTFT=首个非空 text；thinking 仅 reasoning→text；空流 failed。
import { describe, expect, it } from "vitest";
import {
  applyEvent,
  createMeasurementState,
  finalizeSample,
} from "../../engine/measurement";
import { sampleInvariants } from "../../engine/types";

/** 便捷构造：按 [at, event] 序列折叠 */
function fold(events: ReadonlyArray<[number, Parameters<typeof applyEvent>[2]]>) {
  const state = createMeasurementState(0);
  for (const [at, ev] of events) applyEvent(state, at, ev);
  return state;
}

describe("时间线指标", () => {
  it("reasoning→text：ttft/thinking/generation/tps 全量正确", () => {
    const s = finalizeSample(
      fold([
        [100, { type: "reasoning" }],
        [200, { type: "reasoning" }],
        [300, { type: "text" }],
        [400, { type: "text" }],
        [350, { type: "usage", inputTokens: 12, outputTokens: 96 }],
        [500, { type: "finish", stopReason: "end_turn" }],
      ]),
      1000,
    );
    expect(s.status).toBe("complete");
    expect(s.ttftMs).toBe(300);
    expect(s.thinkingMs).toBe(200); // firstText(300) - firstReasoning(100)
    expect(s.generationMs).toBe(100); // lastText(400) - firstText(300)
    expect(s.totalMs).toBe(1000);
    expect(s.outputTokens).toBe(96);
    expect(s.tps).toBe(960); // 96 / 0.1s
    expect(s.tokenSource).toBe("provider");
    expect(sampleInvariants(s)).toEqual([]);
  });

  it("仅正文（无 reasoning）：thinkingMs 为 null（AUD-005 根治）", () => {
    const s = finalizeSample(
      fold([
        [50, { type: "text" }],
        [60, { type: "text" }],
        [60, { type: "usage", inputTokens: 5, outputTokens: 10 }],
      ]),
      100,
    );
    expect(s.status).toBe("complete");
    expect(s.thinkingMs).toBeNull();
    expect(s.ttftMs).toBe(50);
  });

  it("只有 reasoning 没有正文：failed / empty-output（不产生假指标）", () => {
    const s = finalizeSample(
      fold([
        [50, { type: "reasoning" }],
        [60, { type: "finish", stopReason: "end_turn" }],
      ]),
      100,
    );
    expect(s.status).toBe("failed");
    expect(s.error?.code).toBe("empty-output");
    expect(s.ttftMs).toBeNull();
    expect(s.thinkingMs).toBeNull();
  });

  it("空流（2xx 无事件）：failed / empty-output，无负 TTFT（AUD-004 根治）", () => {
    const s = finalizeSample(fold([]), 10);
    expect(s.status).toBe("failed");
    expect(s.error?.code).toBe("empty-output");
    expect(s.ttftMs).toBeNull();
    expect(s.totalMs).toBe(10);
    expect(s.totalMs).toBeGreaterThanOrEqual(0);
  });

  it("usage 缺失：token/TPS null，不字符估算（AUD-006 根治）", () => {
    const s = finalizeSample(
      fold([
        [10, { type: "text" }],
        [110, { type: "text" }],
      ]),
      150,
    );
    expect(s.status).toBe("complete");
    expect(s.outputTokens).toBeNull();
    expect(s.inputTokens).toBeNull();
    expect(s.tps).toBeNull();
    expect(s.tokenSource).toBe("unavailable");
  });

  it("generation 区间为 0（所有正文同一时刻）：tps null 而非 Infinity", () => {
    const s = finalizeSample(
      fold([
        [50, { type: "text" }],
        [50, { type: "usage", inputTokens: 5, outputTokens: 10 }],
      ]),
      80,
    );
    expect(s.status).toBe("complete");
    expect(s.generationMs).toBe(0);
    expect(s.tps).toBeNull();
    expect(sampleInvariants(s)).toEqual([]);
  });

  it("用户取消：cancelled，指标全 null", () => {
    const s = finalizeSample(fold([[10, { type: "text" }]]), 30, {
      cancelled: true,
    });
    expect(s.status).toBe("cancelled");
    expect(s.error?.code).toBe("cancelled");
    expect(s.ttftMs).toBeNull();
  });

  it("协议 error 事件优先级高于已累积指标", () => {
    const s = finalizeSample(
      fold([
        [10, { type: "text" }],
        [20, { type: "error", code: "unknown", safeMessage: "上游流内错误" }],
      ]),
      30,
    );
    expect(s.status).toBe("failed");
    expect(s.error?.code).toBe("unknown");
    expect(s.ttftMs).toBeNull();
  });
});
