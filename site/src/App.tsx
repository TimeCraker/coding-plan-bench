import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Sun, Moon, Github, Zap, Gauge, Shield } from "lucide-react";
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

const ease = [0.16, 1, 0.3, 1] as const;

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
        const genMs = Math.max(1, r.total - r.ttft);
        const entry: LeaderboardEntry = {
          id: genId(),
          label: v.label || v.model,
          endpoint: v.endpoint,
          model: v.model,
          protocol: v.protocol,
          ttft: r.ttft,
          tps: Math.round((r.outputTokens / genMs) * 1000 * 10) / 10,
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
        ttft: 0, total: 0, outputTokens: 0, success: false,
        error: e instanceof Error ? e.message : String(e), samples: 1,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTheme = () => setTheme(toggleTheme());

  return (
    <div className="min-h-screen bg-app relative">
      {/* 背景网格装饰 */}
      <div className="fixed inset-0 grid-bg pointer-events-none opacity-40" aria-hidden="true" />

      <div className="relative">
        <SecurityBanner />

        {/* 顶栏：玻璃质感 */}
        <header className="sticky top-0 z-30 bg-glass border-b border-app">
          <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease }}
              className="flex items-center gap-3"
            >
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-glow-card">
                  <Activity className="w-5 h-5 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <div>
                <h1 className="text-[15px] font-bold leading-tight text-app tracking-tight">Coding Plan Bench</h1>
                <p className="text-[11px] text-muted leading-tight">模型测速台</p>
              </div>
            </motion.div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleTheme}
                title="切换主题"
                className="p-2.5 rounded-xl hover:bg-surface-2 transition-colors cursor-pointer text-muted hover:text-app"
              >
                <motion.span
                  key={theme}
                  initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, ease }}
                  className="inline-block"
                >
                  {theme === "light" ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
                </motion.span>
              </button>
              <a
                href="https://github.com/TimeCraker/coding-plan-bench"
                target="_blank"
                rel="noreferrer"
                className="p-2.5 rounded-xl hover:bg-surface-2 transition-colors cursor-pointer text-muted hover:text-app"
              >
                <Github className="w-[18px] h-[18px]" />
              </a>
            </div>
          </div>
        </header>

        {/* Hero：大排版 */}
        <section className="max-w-6xl mx-auto px-4 md:px-6 pt-16 md:pt-24 pb-8">
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
            }}
          >
            <motion.div
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } } }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-app shadow-sm-card text-xs text-muted mb-6"
            >
              <span className="relative flex w-2 h-2">
                <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-60" />
                <span className="relative rounded-full bg-success w-2 h-2" />
              </span>
              支持 Anthropic / OpenAI 双协议 · 任意模型
            </motion.div>

            <motion.h2
              variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } } }}
              className="text-4xl md:text-6xl font-bold tracking-tight text-app leading-[1.05]"
            >
              谁的模型<br />
              <span className="gradient-text">更快？</span>
            </motion.h2>

            <motion.p
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } } }}
              className="mt-5 text-base md:text-lg text-muted max-w-xl leading-relaxed"
            >
              填入任意模型的 endpoint 和 key，流式采集 TTFT、TPS、Total，加入榜单对比排名。
            </motion.p>

            {/* 特性标签 */}
            <motion.div
              variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } } }}
              className="mt-7 flex flex-wrap gap-2.5"
            >
              {[
                { icon: <Zap className="w-3.5 h-3.5" />, label: "流式采集" },
                { icon: <Gauge className="w-3.5 h-3.5" />, label: "三指标对比" },
                { icon: <Shield className="w-3.5 h-3.5" />, label: "Key 不存储" },
              ].map((f) => (
                <span key={f.label} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-app text-xs font-medium text-muted">
                  <span className="text-primary">{f.icon}</span>
                  {f.label}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </section>

        {/* 主体 */}
        <main className="max-w-6xl mx-auto px-4 md:px-6 pb-20 space-y-6">
          <BenchForm onRun={handleRun} loading={loading} />
          {result && <ResultCard result={result} />}
          <Leaderboard
            entries={entries}
            onRemove={(id) => setEntries(removeEntry(id))}
            onClear={() => { clearLeaderboard(); setEntries([]); }}
            highlightId={highlightId}
          />
          <footer className="text-center text-xs text-muted pt-6 pb-2">
            测速受网络影响，反映本机当前真实表现 · Key 不存储不上传
          </footer>
        </main>
      </div>
    </div>
  );
}
