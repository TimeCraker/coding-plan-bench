// 运行时检测（FR-001）：web 还是 Tauri 壳。
// transport 是显式选择：默认值由运行时决定，samples 永远不改变它。

import type { TransportKind } from "../../../engine/types";

export type RuntimeKind = "web" | "tauri";

/** Tauri v2 在 webview 注入 __TAURI_INTERNALS__（比检查 UA 稳定） */
export function detectRuntime(): RuntimeKind {
  if (typeof window === "undefined") return "web";
  return "__TAURI_INTERNALS__" in window ? "tauri" : "web";
}

/** 浏览器默认 browser-direct；Tauri 默认 tauri-local（Spec §4.1） */
export function defaultTransport(runtime: RuntimeKind): TransportKind {
  return runtime === "tauri" ? "tauri-local" : "browser-direct";
}

/**
 * 可选 transport：Tauri 壳内不提供远端 fallback（项目代理不属于本地版链路），
 * 只有 tauri-local；Web 提供 browser-direct 与 trusted-proxy。
 */
export function availableTransports(runtime: RuntimeKind): TransportKind[] {
  return runtime === "tauri"
    ? ["tauri-local"]
    : ["browser-direct", "trusted-proxy"];
}

/** 可信代理地址（构建期注入或同源 /api）；仅 trusted-proxy 消费 */
export function getApiBase(): string {
  return import.meta.env.VITE_API_BASE || "/api";
}
