// T-003 SSE parser 测试：LF/CRLF/CR、任意 chunk、多 data: 行、comment、UTF-8 flush、EOF 尾事件。
// AUD-003 复现：v1 解析器只搜 "\n\n"，CRLF 流事件数为 0；新 parser 必须全部解析。
import { describe, expect, it } from "vitest";
import { createSSEParser, iterSSEFrames } from "../../engine/parse-sse";
import {
  CRLF_STREAM,
  CR_ONLY_STREAM,
  EOF_TAIL_STREAM,
  HEARTBEAT_MULTIDATA_STREAM,
  UTF8_PAYLOAD,
} from "../fixtures/sse";

/** 把文本按给定粒度切成 chunk 流 */
function chunkify(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

function feed(parser: ReturnType<typeof createSSEParser>, chunks: string[]): string[] {
  const datas: string[] = [];
  for (const c of chunks) for (const ev of parser.push(c)) datas.push(ev.data);
  for (const ev of parser.flush()) datas.push(ev.data);
  return datas;
}

describe("SSE 事件边界", () => {
  it("LF 分隔的事件全部解析", () => {
    const p = createSSEParser();
    const datas = feed(p, [HEARTBEAT_MULTIDATA_STREAM]);
    // 多 data: 行以 \n 拼接成一条
    expect(datas).toEqual(['{"a":1\n,"b":2}', '{"next":true}']);
  });

  it("CRLF 分隔的事件全部解析（AUD-003 复现：v1 对此为 0）", () => {
    const p = createSSEParser();
    const datas = feed(p, [CRLF_STREAM]);
    expect(datas).toHaveLength(2);
    expect(datas[0]).toContain('"one"');
    expect(datas[1]).toContain('"two"');
  });

  it("CR 单独作为行结束（老式服务器）", () => {
    const p = createSSEParser();
    const datas = feed(p, [CR_ONLY_STREAM]);
    expect(datas).toHaveLength(2);
  });

  it("comment / heartbeat 行不产出事件", () => {
    const p = createSSEParser();
    const events = [...p.push(": keep-alive\n\n"), ...p.flush()];
    expect(events).toEqual([]);
  });

  it("无 data 字段的事件不 dispatch（event/id-only 行）", () => {
    const p = createSSEParser();
    const events = [...p.push("event: x\nid: 7\n\n"), ...p.flush()];
    expect(events).toEqual([]);
  });

  it("EOF 无尾随空行时最后一行作为尾事件产出", () => {
    const p = createSSEParser();
    const datas = feed(p, [EOF_TAIL_STREAM]);
    expect(datas).toEqual(['{"first":true}', '{"last":true}']);
  });

  it("event 字段透传", () => {
    const p = createSSEParser();
    const events = [...p.push('event: message\ndata: {}\n\n'), ...p.flush()];
    expect(events[0]?.event).toBe("message");
  });
});

describe("任意 chunk 边界", () => {
  it("1 字节粒度切分与整流输入等价（LF）", () => {
    const whole = feed(createSSEParser(), [HEARTBEAT_MULTIDATA_STREAM]);
    for (const size of [1, 2, 3, 5, 7]) {
      const sliced = feed(createSSEParser(), chunkify(HEARTBEAT_MULTIDATA_STREAM, size));
      expect(sliced).toEqual(whole);
    }
  });

  it("1 字节粒度切分与整流输入等价（CRLF）", () => {
    const whole = feed(createSSEParser(), [CRLF_STREAM]);
    for (const size of [1, 2, 4]) {
      const sliced = feed(createSSEParser(), chunkify(CRLF_STREAM, size));
      expect(sliced).toEqual(whole);
    }
  });

  it("chunk 边界切在 CRLF 中间（\\r 与 \\n 分属两个 chunk）", () => {
    const p = createSSEParser();
    const datas = feed(p, [CRLF_STREAM.replace("\r\n", "\r"), "\n"]);
    expect(datas).toHaveLength(2);
  });
});

describe("iterSSEFrames（ReadableStream 集成）", () => {
  it("UTF-8 多字节跨 chunk + decoder flush", async () => {
    const bytes = new TextEncoder().encode(UTF8_PAYLOAD);
    // 按字节 3 个一组切：中文字符一定被切开
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < bytes.length; i += 3) {
      chunks.push(bytes.slice(i, i + 3));
    }
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (const ch of chunks) c.enqueue(ch);
        c.close();
      },
    });
    const frames = [];
    for await (const f of iterSSEFrames(stream)) frames.push(f);
    expect(frames).toHaveLength(1);
    expect(frames[0]!.data).toBe('{"text":"中文测速✓"}');
  });

  it("字节流 CRLF 全解析", async () => {
    const bytes = new TextEncoder().encode(CRLF_STREAM);
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes);
        c.close();
      },
    });
    const frames = [];
    for await (const f of iterSSEFrames(stream)) frames.push(f);
    expect(frames).toHaveLength(2);
  });
});
