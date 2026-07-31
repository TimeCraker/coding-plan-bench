// SSE 流解析：把 ReadableStream<Uint8Array> 拆成 data 事件 JSON
// 与运行时无关（Node / Worker / 浏览器都用 Web ReadableStream API）

/** 从 SSE 流中迭代出每个 data: 行的 JSON 对象 */
export async function* iterSSEEvents(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE 事件以空行分隔（\n\n，兼容 \r\n\r\n）
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const event = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const dataLine = event
          .split("\n")
          .find((l) => l.startsWith("data:"));
        if (!dataLine) continue;
        const json = dataLine.slice(5).trim();
        if (!json || json === "[DONE]") continue;
        try {
          yield JSON.parse(json) as Record<string, unknown>;
        } catch {
          // 非 JSON 心跳，忽略
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
