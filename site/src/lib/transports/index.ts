// transport orchestrator（FR-001 / AC-003 核心）：
// - transport 是调用方显式给定的输入，本层不存在"按 samples 选 transport"的代码路径
// - trusted-proxy 需要 consent；browser-direct / tauri-local 直接执行
// - 统一返回 BenchmarkRunResult（schema v2）

import type {
  BenchmarkRunResult,
  TransportKind,
} from "../../../../engine/types";
import { benchError } from "../../../../engine/errors";
import type { ConsentToken } from "./trusted-proxy";
import { createTrustedProxyTransport } from "./trusted-proxy";
import { createBrowserDirectTransport } from "./browser-direct";
import { createTauriLocalTransport, loadTauriTransport } from "./tauri-local";
import type { Transport, TransportRequest } from "./types";

export type { Transport, TransportRequest } from "./types";
export type { ConsentToken } from "./trusted-proxy";
export { createConsentToken } from "./trusted-proxy";
export { createBrowserDirectTransport } from "./browser-direct";
export { createTrustedProxyTransport } from "./trusted-proxy";
export { createTauriLocalTransport, loadTauriTransport } from "./tauri-local";

export interface RunBenchOptions extends TransportRequest {
  transport: TransportKind;
  /** trusted-proxy 必需；其余 transport 忽略 */
  consent?: ConsentToken;
  /** 注入 fetch（测试）；默认各 transport 自己解析 */
  fetchImpl?: typeof fetch;
}

export async function runBench(opts: RunBenchOptions): Promise<BenchmarkRunResult> {
  const { transport, consent, fetchImpl, ...req } = opts;

  let t: Transport;
  switch (transport) {
    case "browser-direct":
      t = createBrowserDirectTransport(fetchImpl);
      break;
    case "trusted-proxy":
      t = createTrustedProxyTransport({ consent, fetchImpl });
      break;
    case "tauri-local":
      t = fetchImpl ? createTauriLocalTransport(fetchImpl) : await loadTauriTransport();
      break;
    default:
      throw benchError("validation", `未知 transport: ${String(transport)}`);
  }
  return t.run(req);
}
