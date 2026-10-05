// browser-direct：浏览器直接向 provider 发请求（Key 不经过任何项目服务器）。
// CORS/网络失败不自动降级代理（FR-001）——失败样本 code=cors/network，由 UI 提供选项。

import { buildProtocolRequest } from "../../../../engine/request";
import { runBenchmark } from "../../../../engine/bench";
import type { Transport } from "./types";

export function createBrowserDirectTransport(
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
): Transport {
  return {
    kind: "browser-direct",
    async run(req) {
      const built = buildProtocolRequest({
        requestUrl: req.requestUrl,
        apiKey: req.apiKey,
        model: req.model,
        protocol: req.protocol,
        profile: req.profile,
      });
      return runBenchmark(built, {
        protocol: req.protocol,
        samples: req.samples,
        profile: {
          id: req.profile.id,
          version: req.profile.version,
          promptSha256: req.profile.promptSha256,
        },
        transport: "browser-direct",
        fetchImpl,
        timeoutMs: req.profile.timeoutMs,
        signal: req.signal,
        onProgress: req.onProgress,
      });
    },
  };
}
