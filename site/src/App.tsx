import { useEffect, useRef, useState } from "react";
import type { TransportKind } from "../../engine/types";
import { initTheme, toggleTheme, getTheme } from "./lib/theme";
import {
  availableTransports,
  defaultTransport,
  detectRuntime,
} from "./lib/runtime";
import { createConsentToken } from "./lib/transports";
import { useBenchmarkRun } from "./hooks/useBenchmarkRun";
import { SecurityBanner } from "./components/SecurityBanner";
import { BenchForm, type FormValues } from "./components/BenchForm";
import { TransportSelector } from "./components/TransportSelector";
import { RunProgress } from "./components/RunProgress";
import { ResultCard } from "./components/ResultCard";
import { Leaderboard } from "./components/Leaderboard";
import { GlobalLeaderboard } from "./components/GlobalLeaderboard";
import { Sidebar, type View } from "./components/Sidebar";
import { Methodology } from "./components/Methodology";
import {
  APP_SUBTITLE,
  APP_TITLE,
  FOOTER_BENCH,
} from "./content/copy";
import {
  clearLeaderboard,
  loadLeaderboard,
  makeEntryFromRun,
  mergeExternalSnapshot,
  removeEntry,
  resetLocalData,
  restoreEntry,
} from "./lib/storage";
import type { LeaderboardEntryV2 } from "../../engine/types";

export default function App() {
  // 纯客户端 SPA：localStorage 在 lazy initializer 中同步可读，避免 effect 级联渲染
  const [{ entries: stored, recovery }, setStored] = useState(() => loadLeaderboard());
  const [entries, setEntries] = useState<LeaderboardEntryV2[]>(stored);
  const lastForm = useRef<FormValues | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    initTheme();
    return getTheme();
  });
  const [view, setView] = useState<View>("bench");

  // 运行时与 transport（FR-001）：显式选择，samples 不改变它
  const runtime = detectRuntime();
  const [transport, setTransport] = useState<TransportKind>(() =>
    defaultTransport(detectRuntime()),
  );

  const run = useBenchmarkRun();

  const handleRun = (v: FormValues) => {
    lastForm.current = v;
    void run.start({
      transport,
      requestUrl: v.requestUrl,
      apiKey: v.apiKey,
      model: v.model,
      protocol: v.protocol,
      samples: v.samples === 3 || v.samples === 5 ? v.samples : 1,
    });
  };

  // 完整结果入榜（partial/failed/cancelled 不入）；只有 complete 参与 rankable
  useEffect(() => {
    if (run.result?.status === "complete" && lastForm.current) {
      const v = lastForm.current;
      const entry = makeEntryFromRun({
        label: v.label,
        protocol: v.protocol,
        requestUrl: v.requestUrl,
        model: v.model,
        run: run.result,
      });
      setEntries((prev) => {
        const merged = mergeExternalSnapshot(prev, [entry]);
        return merged;
      });
      // 持久化（写入 v2 key；makeEntryFromRun 已保证 rankable 语义）
      import("./lib/storage").then(({ addEntry }) => {
        setEntries(addEntry(entry));
      });
    }
  }, [run.result]);

  // 多标签页：storage event 同步（ranAt/id 去重合并）
  useEffect(() => {
    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== "cpb:leaderboard:v2" || ev.newValue === null) return;
      try {
        const snapshot = JSON.parse(ev.newValue) as LeaderboardEntryV2[];
        setEntries((prev) => mergeExternalSnapshot(prev, snapshot));
      } catch {
        // 其他标签页写入损坏数据：忽略，本页数据不受影响
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleTheme = () => setTheme(toggleTheme());

  // compact hero 文案（非 bench 视图沿用 owner 的能力榜介绍）
  const heroConfig = {
    bench: {
      title: APP_TITLE,
      desc: APP_SUBTITLE,
    },
    global: {
      title: "全球模型能力与套餐参考",
      desc: "综合智能、Agent 能力、性价比与订阅制套餐横向对比（行业参考数据，非本机实测）。测速请切回左侧「测速台」。",
    },
  }[view];

  return (
    <div className="min-h-screen bg-app relative">
      {/* 背景装饰：CSS 循环动画（prefers-reduced-motion 由全局 CSS 覆盖停止） */}
      <div
        className="fixed inset-0 grid-bg pointer-events-none opacity-40"
        aria-hidden="true"
      />
      <div
        aria-hidden="true"
        className="fixed -top-40 left-1/4 w-[600px] h-[600px] rounded-full pointer-events-none bg-drift-a"
        style={{
          background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)",
          opacity: 0.08,
        }}
      />
      <div
        aria-hidden="true"
        className="fixed top-20 right-0 w-[500px] h-[500px] rounded-full pointer-events-none bg-drift-b"
        style={{
          background: "radial-gradient(circle, var(--cta) 0%, transparent 70%)",
          opacity: 0.06,
        }}
      />

      <div className="relative flex flex-col md:flex-row">
        <Sidebar view={view} onView={setView} theme={theme} onTheme={handleTheme} />

        <div className="flex-1 min-w-0">
          <SecurityBanner />

          {/* 紧凑价值说明（取代营销大 Hero，工具表单前置） */}
          <section className="max-w-6xl mx-auto px-4 md:px-6 pt-6 md:pt-8 pb-6">
            <div key={view} className="anim-fade-up">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-app">
                {heroConfig.title}
              </h1>
              <p className="mt-2 text-sm text-muted max-w-2xl leading-relaxed">
                {heroConfig.desc}
              </p>
            </div>
          </section>

          {/* 主体：按 view 切换 */}
          <main className="max-w-6xl mx-auto px-4 md:px-6 pb-20">
              {view === "bench" ? (
                <div className="anim-fade-up space-y-6">
                  {/* 顺序（Spec §4.1）：执行位置/Key 路径 → 表单 → 进度/结果 → 榜单 → 方法学 */}
                  <TransportSelector
                    value={transport}
                    available={availableTransports(runtime)}
                    onChange={setTransport}
                  />
                  <BenchForm onRun={handleRun} busy={run.phase === "running" || run.phase === "validating"} />
                  <RunProgress
                    phase={run.phase}
                    progress={run.progress}
                    onGrantConsent={() => run.grantConsent(createConsentToken())}
                    onDeclineConsent={run.reset}
                    onCancel={run.cancel}
                  />
                  {run.result && <ResultCard run={run.result} />}
                  {run.error && (
                    <div
                      role="alert"
                      className="bg-surface rounded-2xl border border-app shadow-md-card p-4 text-sm text-app"
                    >
                      {run.error.safeMessage}
                    </div>
                  )}
                  <Leaderboard
                    entries={entries}
                    onRemove={(id) => {
                      const r = removeEntry(id);
                      setEntries(r.entries);
                      return r;
                    }}
                    onRestore={(e) => setEntries(restoreEntry(e))}
                    onClear={() => {
                      clearLeaderboard();
                      setEntries([]);
                    }}
                    recovery={recovery}
                    onReset={() => {
                      resetLocalData();
                      setStored(loadLeaderboard());
                      setEntries(loadLeaderboard().entries);
                    }}
                  />
                  <Methodology />
                </div>
              ) : (
                <div className="anim-fade-up">
                  <GlobalLeaderboard />
                </div>
              )}

            <footer className="text-center text-xs text-muted pt-6 pb-2">
              {view === "bench"
                ? FOOTER_BENCH
                : "能力榜为行业参考数据（Artificial Analysis 等），非本机实测"}
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
