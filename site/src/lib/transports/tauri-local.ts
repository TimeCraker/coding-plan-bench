// tauri-local：Tauri 壳内通过官方 HTTP 插件（native fetch）复用 engine（FR-009）。
// 生产链路只有 provider 直连——本文件不 import getApiBase、不请求项目 /api。

import { buildProtocolRequest } from "../../../../engine/request";
import { runBenchmark } from "../../../../engine/bench";
import type { Transport } from "./types";

export function createTauriLocalTransport(
  nativeFetch: typeof fetch,
): Transport {
  return {
    kind: "tauri-local",
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
        transport: "tauri-local",
        fetchImpl: nativeFetch,
        timeoutMs: req.profile.timeoutMs,
        signal: req.signal,
        onProgress: req.onProgress,
      });
    },
  };
}

/** 运行时加载 Tauri HTTP 插件（仅在 Tauri 壳内可解析） */
export async function loadTauriTransport(): Promise<Transport> {
  const mod = await import("@tauri-apps/plugin-http");
  return createTauriLocalTransport(mod.fetch);
}
