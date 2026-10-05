// 测速运行状态机（Spec §4.1）：
// idle → validating → consent-required → running → complete|partial|failed|cancelled
// - trusted-proxy 无 consent 时停在 consent-required，不发出任何请求
// - 取消：abort 当前样本并阻止后续；结果 cancelled 不入榜（持久化由调用方判断 status）
// - 离开组件时 abort（useEffect cleanup）

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BenchmarkRunResult,
  SampleResult,
  TransportKind,
} from "../../../engine/types";
import type { BenchError } from "../../../engine/errors";
import { validateRequestUrl } from "../../../engine/request";
import { CPB_STANDARD_PROFILE } from "../../../engine/profiles";
import { runBench, type ConsentToken } from "../lib/transports";

export type RunPhase =
  | "idle"
  | "validating"
  | "consent-required"
  | "running"
  | "settled";

export interface RunProgress {
  index: number;
  total: number;
  sample: SampleResult;
}

export interface StartOptions {
  transport: TransportKind;
  requestUrl: string;
  apiKey: string;
  model: string;
  protocol: "anthropic" | "openai";
  samples: 1 | 3 | 5;
  consent?: ConsentToken;
}

export function useBenchmarkRun() {
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [result, setResult] = useState<BenchmarkRunResult | null>(null);
  const [error, setError] = useState<BenchError | null>(null);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [consentFor, setConsentFor] = useState<StartOptions | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 离开组件时终止正在运行的请求
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const start = useCallback(async (opts: StartOptions) => {
    setPhase("validating");
    setError(null);
    setResult(null);
    setProgress(null);

    const urlCheck = validateRequestUrl(opts.requestUrl);
    if (!urlCheck.ok) {
      setError({ code: "validation", safeMessage: `Request URL 无效：${urlCheck.reason}` });
      setPhase("settled");
      return;
    }

    if (opts.transport === "trusted-proxy" && !opts.consent) {
      setConsentFor(opts);
      setPhase("consent-required");
      return;
    }
    setConsentFor(null);

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("running");
    try {
      const run = await runBench({
        transport: opts.transport,
        requestUrl: opts.requestUrl,
        apiKey: opts.apiKey,
        model: opts.model,
        protocol: opts.protocol,
        samples: opts.samples,
        consent: opts.consent,
        profile: CPB_STANDARD_PROFILE,
        signal: controller.signal,
        onProgress: (p) => setProgress(p),
      });
      setResult(run);
      setPhase("settled");
    } catch (e) {
      const err: BenchError =
        e && typeof e === "object" && "code" in e && "safeMessage" in e
          ? (e as BenchError)
          : { code: "unknown", safeMessage: "未知错误" };
      setError(err);
      setPhase("settled");
    } finally {
      abortRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /** 用户确认使用代理（从 consent-required 继续） */
  const grantConsent = useCallback(
    (token: ConsentToken) => {
      if (!consentFor) return;
      void start({ ...consentFor, consent: token });
    },
    [consentFor, start],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("idle");
    setResult(null);
    setError(null);
    setProgress(null);
    setConsentFor(null);
  }, []);

  return {
    phase,
    result,
    error,
    progress,
    consentFor,
    start,
    cancel,
    grantConsent,
    reset,
  };
}
