// SSE 原始流 fixture：以字符串常量提供可复用的协议样本。
// chunk 切分策略由测试参数化（任意粒度切分是 parser 的契约）。

/** Anthropic Messages SSE：message_start(usage) → thinking → text → message_delta(usage+stop) → message_stop */
export const ANTHROPIC_STREAM = [
  'event: message_start',
  'data: {"type":"message_start","message":{"usage":{"input_tokens":12,"output_tokens":1}}}',
  '',
  'event: content_block_start',
  'data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking"}}',
  '',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"let me"}}',
  '',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":" think"}}',
  '',
  'event: content_block_start',
  'data: {"type":"content_block_start","index":1,"content_block":{"type":"text"}}',
  '',
  'data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"Hello"}}',
  '',
  'data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":" world"}}',
  '',
  'event: content_block_stop',
  'data: {"type":"content_block_stop","index":1}',
  '',
  'event: message_delta',
  'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":12,"output_tokens":96}}',
  '',
  'event: message_stop',
  'data: {"type":"message_stop"}',
  '',
].join("\n");

/** Anthropic 空流：2xx 但没有任何正文 delta */
export const ANTHROPIC_EMPTY_STREAM = [
  'event: message_start',
  'data: {"type":"message_start","message":{"usage":{"input_tokens":12,"output_tokens":1}}}',
  '',
  'event: message_stop',
  'data: {"type":"message_stop"}',
  '',
].join("\n");

/** OpenAI Chat Completions SSE：reasoning → content → finish → usage → [DONE] */
export const OPENAI_STREAM = [
  'data: {"choices":[{"index":0,"delta":{"role":"assistant","reasoning_content":"think"}}]}',
  '',
  'data: {"choices":[{"index":0,"delta":{"content":"Hi"}}]}',
  '',
  'data: {"choices":[{"index":0,"delta":{"content":" there"}}]}',
  '',
  'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
  '',
  'data: {"choices":[],"usage":{"prompt_tokens":9,"completion_tokens":42}}',
  '',
  'data: [DONE]',
  '',
].join("\n");

/** OpenAI 无 usage（未开 stream_options.include_usage） */
export const OPENAI_NO_USAGE_STREAM = [
  'data: {"choices":[{"index":0,"delta":{"content":"A"}}]}',
  '',
  'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
  '',
  'data: [DONE]',
  '',
].join("\n");

/** 心跳 + 注释 + 多 data: 行拼接 */
export const HEARTBEAT_MULTIDATA_STREAM = [
  ': keep-alive comment',
  '',
  'event: message',
  'data: {"a":1',
  'data: ,"b":2}',
  '',
  'data: {"next":true}',
  '',
].join("\n");

/** CRLF 版本（审计 AUD-003 复现源：v1 解析器对它产出 0 事件） */
export const CRLF_STREAM = [
  'data: {"type":"content_block_delta","delta":{"text":"one"}}',
  '',
  'data: {"type":"content_block_delta","delta":{"text":"two"}}',
  '',
].join("\r\n");

/** 无尾随空行的 EOF 尾事件（最后一行后直接 EOF） */
export const EOF_TAIL_STREAM = [
  'data: {"first":true}',
  '',
  'data: {"last":true}',
].join("\n");

/** 老式 CR 行结束（无 LF） */
export const CR_ONLY_STREAM = [
  "data: {\"cr\":1}",
  "",
  "data: {\"cr\":2}",
  "",
].join("\r");

/** UTF-8 多字节跨 chunk 场景的原始字节序列由测试动态构造 */
export const UTF8_PAYLOAD = 'data: {"text":"中文测速✓"}\n\n';
