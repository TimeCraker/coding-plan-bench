import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Sun, Moon, Github } from "lucide-react";
import type { LeaderboardEntry } from "../../engine/types";
import { initTheme, toggleTheme, getTheme } from "./lib/theme";
import { runBench, type BenchApiResponse } from "./lib/api";
import {
  loadLeaderboard,
  addEntry,
  removeEntry,
  clearLeaderboard,
  genId,
} from "./lib/storage";
import { SecurityBanner } from "./components/SecurityBanner";
import { BenchForm, type FormValues } from "./components/BenchForm";
import { ResultCard } from "./components/ResultCard";
import { Leaderboard } from "./components/Leaderboard";

export default function App() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BenchApiResponse | null>(null);
  const [highlightId, setHighlightId] = useState<string | undefined>();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    initTheme();
    setTheme(getTheme());
    setEntries(loadLeaderboard());
  }, []);

  const handleRun = async (v: FormValues) => {
    setLoading(true);
    setResult(null);
    try {
      const r = await runBench({
        endpoint: v.endpoint,
        apiKey: v.apiKey,
        model: v.model,
        protocol: v.protocol,
        samples: v.samples,
      });
      setResult(r);
      if (r.success) {
        const entry: LeaderboardEntry = {
          id: genId(),
          label: v.label || v.model,
          endpoint: v.endpoint,
          model: v.model,
          protocol: v.protocol,
          ttft: r.ttft,
          tps:
            r.samples > 1
              ? Math.round((r.outputTokens / Math.max(1, r.total - r.ttft)) * 1000 * 10) / 10
              : Math.round((r.outputTokens / Math.max(1, r.total - r.ttft)) * 1000 * 10) / 10,
          total: r.total,
          outputTokens: r.outputTokens,
          samples: r.samples,
          ranAt: new Date().toISOString(),
        };
        const list = addEntry(entry);
        setEntries(list);
        setHighlightId(entry.id);
        setTimeout(() => setHighlightId(undefined), 2000);
      }
    } catch (e) {
      setResult({
        ttft: 0,
        total: 0,
        outputTokens: 0,
        success: false,
        error: e instanceof Error ? e.message : String(e),
        samples: 1,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTheme = () => setTheme(toggleTheme());

  return (
    <div className="min-h-screen bg-app">
      <SecurityBanner />

      {/* 顶栏 */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-surface/80 border-b border-app">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight text-app">Coding Plan Bench</h1>
              <p className="text-[11px] text-muted leading-tight">模型测速台</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleTheme}
              title="切换主题"
              className="p-2 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer text-muted"
            >
              <motion.span
                key={theme}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="inline-block"
              >
                {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </motion.span>
            </button>
            <a
              href="https://github.com/TimeCraker/coding-plan-bench"
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer text-muted"
            >
              <Github className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 pt-10 pb-6">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="text-3xl md:text-4xl font-bold tracking-tight text-app"
        >
          谁的模型<span className="text-primary">更快？</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.08 }}
          className="mt-2 text-muted max-w-2xl"
        >
          填入任意模型的 endpoint 和 key，流式采集 TTFT、TPS、Total，加入榜单对比排名。
        </motion.p>
      </section>

      {/* 主体 */}
      <main className="max-w-6xl mx-auto px-4 md:px-6 pb-16 space-y-6">
        <BenchForm onRun={handleRun} loading={loading} />

        {result && <ResultCard result={result} />}

        <Leaderboard
          entries={entries}
          onRemove={(id) => setEntries(removeEntry(id))}
          onClear={() => {
            clearLeaderboard();
            setEntries([]);
          }}
          highlightId={highlightId}
        />

        <footer className="text-center text-xs text-muted pt-4">
          测速受网络影响，反映本机当前真实表现 · key 不存储不上传
        </footer>
      </main>
    </div>
  );
}
