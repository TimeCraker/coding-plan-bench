import { useEffect, useRef, useState } from "react";
import type { TransportKind } from "../../engine/types";
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
import { Masthead, type View } from "./components/Sidebar";
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

  // hero 文案与版面记号（display 级标题 + hairline 规线行，随 view 切换）
  const heroConfig = {
    bench: {
      title: APP_TITLE,
      desc: APP_SUBTITLE,
      meta: "TTFT · TPS · TOTAL — 同条件三指标对比",
      mark: "BENCH — 01",
    },
    global: {
      title: "全球模型能力与套餐参考",
      desc: "综合智能、Agent 能力、性价比与订阅制套餐横向对比（行业参考数据，非本机实测）。测速请切回「测速台」。",
      meta: "IQ · AG · VAL · PLN — 行业参考 · 非本机实测",
      mark: "GLOBAL — 02",
    },
  }[view];

  return (
    <div className="min-h-screen bg-paper">
      <Masthead view={view} onView={setView} />

      {/* 主体单列 wrap：max 1240 / 桌面 36px · 移动 16px 水平留白（对齐 agent-hive .wrap） */}
      <div className="mx-auto w-full max-w-[1240px] px-4 pb-14 md:px-9">
        <SecurityBanner />

        {/* 版面头部（display 级大标题即首屏视觉锚 + hairline 规线收尾，与首面板形成整体） */}
        <section className="pt-8 pb-5">
          <div key={view} className="anim-fade-up">
            <h1 className="font-disp text-[30px] font-bold leading-[1.05] tracking-[-0.035em] text-ink md:text-[44px] lg:text-[52px]">
              {heroConfig.title}
            </h1>
            <p className="mt-3 max-w-[60ch] text-[15px] leading-[1.6] text-ink-2 md:text-base">
              {heroConfig.desc}
            </p>
            {/* 印刷版面记号行：左指标口径 / 右视图页码（随 view 切换） */}
            <div className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-1.5 border-t border-line pt-2.5">
              <span className="lbl-mono">{heroConfig.meta}</span>
              <span className="lbl-mono ml-auto whitespace-nowrap">{heroConfig.mark}</span>
            </div>
          </div>
        </section>

        {/* 主体：按 view 切换 */}
        <main>
          {view === "bench" ? (
            <div className="anim-fade-up space-y-8">
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
                  className="border border-line-2 border-l-[3px] border-l-bad bg-panel p-4 text-sm text-ink"
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

          {/* colophon（印刷版权页制式）：hairline 顶边 + 制式记号行 + 口径说明行 */}
          <footer className="mt-10 border-t border-line pt-3 pb-2">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
              <span className="lbl-mono">CPB · SWISS INDUSTRIAL PRINT · PROFILE CPB-STANDARD@1</span>
              <span className="lbl-mono ml-auto whitespace-nowrap">数据仅存浏览器本地 · MMXXVI</span>
            </div>
            <p className="mt-2 border-t border-line pt-2 font-mono text-[10.5px] leading-[1.7] text-ink-3">
              {view === "bench"
                ? FOOTER_BENCH
                : "能力榜为行业参考数据（Artificial Analysis 等），非本机实测"}
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
