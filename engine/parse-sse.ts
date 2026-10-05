// SSE 流解析（AUD-003 根治）：按 WHATWG SSE 语义解析事件帧。
//
// 与 v1 的差异：
// - 行结束符支持 CRLF / LF / CR（v1 只搜 "\n\n"，CRLF 流事件数为 0）
// - 多 `data:` 行以 "\n" 拼接；comment（`:` 开头）忽略；event/id 透传
// - 输出原始 data 字符串，不做 JSON 解析（协议适配器负责，非法 JSON 必须显式失败）
// - 增量状态机：任意 chunk 边界安全；EOF 时残余行作为尾事件 flush
// - UTF-8 多字节安全：解码交给 TextDecoder(stream)+flush，行扫描在解码后的字符串上进行

/** 一条完整 SSE 事件帧（只有含 data 行的事件才会被 dispatch） */
export interface SSEEvent {
  data: string;
  event?: string;
  id?: string;
  retry?: number;
}

export interface SSEParser {
  /** 喂入已解码文本，返回本次新完成的完整事件 */
  push(text: string): SSEEvent[];
  /** EOF：处理残余行并 dispatch 尾事件 */
  flush(): SSEEvent[];
}

interface FieldBuffers {
  data: string[];
  eventName?: string;
  id?: string;
  retry?: number;
}

function blankFields(): FieldBuffers {
  return { data: [] };
}

export function createSSEParser(): SSEParser {
  let buffer = "";
  let fields = blankFields();

  /** 处理一行（非空行）字段 */
  function processLine(line: string): void {
    if (line.startsWith(":")) return; // comment / heartbeat
    let field: string;
    let value: string;
    const ci = line.indexOf(":");
    if (ci === -1) {
      field = line;
      value = "";
    } else {
      field = line.slice(0, ci);
      value = line.slice(ci + 1);
      if (value.startsWith(" ")) value = value.slice(1); // 冒号后至多一个空格
    }
    switch (field) {
      case "data":
        fields.data.push(value);
        break;
      case "event":
        fields.eventName = value;
        break;
      case "id":
        if (!value.includes("\0")) fields.id = value;
        break;
      case "retry": {
        const n = Number.parseInt(value, 10);
        if (Number.isFinite(n)) fields.retry = n;
        break;
      }
      default:
        break; // 未知合法字段：忽略，不破坏后续事件
    }
  }

  /** 空行：dispatch 当前事件（必须有 data 行）并重置 */
  function dispatch(): SSEEvent | null {
    const f = fields;
    fields = blankFields();
    if (f.data.length === 0) return null;
    return {
      data: f.data.join("\n"),
      event: f.eventName,
      id: f.id,
      retry: f.retry,
    };
  }

  /**
   * 从 buffer 头部持续取完整行。
   * treatTrailingCR：true 时（flush 场景）尾部孤立 "\r" 也视为行结束。
   */
  function drain(out: SSEEvent[], treatTrailingCR: boolean): void {
    for (;;) {
      let idx = -1;
      let len = 0;
      for (let i = 0; i < buffer.length; i++) {
        const c = buffer[i];
        if (c === "\n") {
          idx = i;
          len = 1;
          break;
        }
        if (c === "\r") {
          if (i + 1 < buffer.length) {
            idx = i;
            len = buffer[i + 1] === "\n" ? 2 : 1;
          } else if (treatTrailingCR) {
            idx = i;
            len = 1;
          }
          break;
        }
      }
      if (idx === -1) break; // 没有完整行边界
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + len);
      if (line === "") {
        const ev = dispatch();
        if (ev) out.push(ev);
      } else {
        processLine(line);
      }
    }
  }

  return {
    push(text: string): SSEEvent[] {
      buffer += text;
      const out: SSEEvent[] = [];
      // 非 flush 场景：尾部孤立 "\r" 保留（可能是被切断的 "\r\n"）
      drain(out, false);
      return out;
    },
    flush(): SSEEvent[] {
      const out: SSEEvent[] = [];
      drain(out, true);
      if (buffer.length > 0) {
        // 无行结束符的最后一行（EOF 截断）
        processLine(buffer);
        buffer = "";
      }
      const ev = dispatch();
      if (ev) out.push(ev);
      return out;
    },
  };
}

/** 从二进制流迭代 SSE 事件帧（UTF-8 跨 chunk 安全，EOF flush 尾事件） */
export async function* iterSSEFrames(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<SSEEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const parser = createSSEParser();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const ev of parser.push(decoder.decode(value, { stream: true }))) {
        yield ev;
      }
    }
    // decoder flush：残余的不完整多字节序列在此落地
    const tail = decoder.decode();
    if (tail) {
      for (const ev of parser.push(tail)) yield ev;
    }
    for (const ev of parser.flush()) yield ev;
  } finally {
    reader.releaseLock();
  }
}

/**
 * @deprecated v1 JSON 便利层：仅供旧 bench.ts 过渡使用，T-004 重写后删除。
 * 行为：跳过空 data 与 [DONE]，吞掉 JSON 错误（v1 兼容）。
 */
export async function* iterSSEEvents(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>> {
  for await (const frame of iterSSEFrames(stream)) {
    if (!frame.data || frame.data === "[DONE]") continue;
    try {
      yield JSON.parse(frame.data) as Record<string, unknown>;
    } catch {
      // v1 行为：非 JSON 心跳忽略（新链路由协议适配器显式抛错）
    }
  }
}
