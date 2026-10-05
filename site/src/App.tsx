import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Gauge, Shield, Coins, Brain, TrendingDown } from "lucide-react";
import type { LeaderboardEntry } from "../../engine/types";
import { initTheme, toggleTheme, getTheme } from "./lib/theme";
import { legacyRunBench, type BenchApiResponse } from "./lib/api";
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
import { GlobalLeaderboard } from "./components/GlobalLeaderboard";
import { Sidebar, type View } from "./components/Sidebar";

const ease = [0.16, 1, 0.3, 1] as const;

export default function App() {
  // 纯客户端 SPA：localStorage 在 lazy initializer 中同步可读，避免 effect 级联渲染
  const [entries, setEntries] = useState<LeaderboardEntry[]>(() => loadLeaderboard());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BenchApiResponse | null>(null);
  const [highlightId, setHighlightId] = useState<string | undefined>();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    initTheme();
    return getTheme();
  });
  const [view, setView] = useState<View>("bench");

  const handleRun = async (v: FormValues) => {
    setLoading(true);
    setResult(null);
    try {
      // 过渡期：单样本 browser-direct（samples>1 不再自动切代理，T-007 接显式 transport UI）
      const r = await legacyRunBench({
        requestUrl: v.endpoint,
        apiKey: v.apiKey,
        model: v.model,
        protocol: v.protocol,
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

  // 两个功能的 Hero 配置
  const heroConfig = {
    bench: {
      badge: "支持 Anthropic / OpenAI 双协议 · 任意模型",
      title: <>谁的模型<br /><span className="gradient-text">更快？</span></>,
      desc: "填入任意模型的 endpoint 和 API Key，流式采集 TTFT、TPS、Total，加入榜单对比排名。",
      features: [
        { icon: <Zap className="w-3.5 h-3.5" />, label: "流式采集" },
        { icon: <Gauge className="w-3.5 h-3.5" />, label: "三指标对比" },
        { icon: <Shield className="w-3.5 h-3.5" />, label: "Key 不存储" },
      ],
    },
    global: {
      badge: "行业参考数据 · 2026-08 · 每周可更新",
      title: <>谁更强？<br /><span className="gradient-text">谁更值？</span></>,
      desc: "全球模型综合智能、单任务成本、订阅制套餐横向对比。测速看本机表现，这里看行业水平。",
      features: [
        { icon: <Brain className="w-3.5 h-3.5" />, label: "综合智能" },
        { icon: <Coins className="w-3.5 h-3.5" />, label: "性价比" },
        { icon: <TrendingDown className="w-3.5 h-3.5" />, label: "订阅对比" },
      ],
    },
  }[view];

  return (
    <div className="min-h-screen bg-app relative">
      {/* 背景装饰 */}
      <div className="fixed inset-0 grid-bg pointer-events-none opacity-40" aria-hidden="true" />
      <motion.div
        aria-hidden="true"
        className="fixed -top-40 left-1/4 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)", opacity: 0.08 }}
        animate={{ x: [0, 80, 0], y: [0, 40, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="fixed top-20 right-0 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, var(--cta) 0%, transparent 70%)", opacity: 0.06 }}
        animate={{ x: [0, -60, 0], y: [0, 60, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative flex">
        <Sidebar view={view} onView={setView} theme={theme} onTheme={handleTheme} />

        <div className="flex-1 min-w-0">
          <SecurityBanner />

          {/* Hero：随 view 切换 */}
          <section className="max-w-6xl mx-auto px-4 md:px-6 pt-10 md:pt-16 pb-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, y: -8 }}
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } }}
              >
                <motion.div
                  variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } } }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-app shadow-sm-card text-xs text-muted mb-6"
                >
                  <span className="relative flex w-2 h-2">
                    <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-60" />
                    <span className="relative rounded-full bg-success w-2 h-2" />
                  </span>
                  {heroConfig.badge}
                </motion.div>

                <motion.h2
                  variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } } }}
                  className="text-4xl md:text-6xl font-bold tracking-tight text-app leading-[1.05]"
                >
                  {heroConfig.title}
                </motion.h2>

                <motion.p
                  variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } } }}
                  className="mt-5 text-base md:text-lg text-muted max-w-xl leading-relaxed"
                >
                  {heroConfig.desc}
                </motion.p>

                <motion.div
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.3 } } }}
                  className="mt-7 flex flex-wrap gap-2.5"
                >
                  {heroConfig.features.map((f) => (
                    <motion.span
                      key={f.label}
                      variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease } } }}
                      whileHover={{ y: -2 }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-app text-xs font-medium text-muted cursor-default shadow-sm-card hover:shadow-md-card transition-shadow"
                    >
                      <span className="text-primary">{f.icon}</span>
                      {f.label}
                    </motion.span>
                  ))}
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </section>

          {/* 主体：按 view 切换 */}
          <main className="max-w-6xl mx-auto px-4 md:px-6 pb-20">
            <AnimatePresence mode="wait">
              {view === "bench" ? (
                <motion.div
                  key="bench"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease }}
                  className="space-y-6"
                >
                  <BenchForm onRun={handleRun} loading={loading} />
                  <AnimatePresence mode="wait">
                    {result && <ResultCard result={result} />}
                  </AnimatePresence>
                  <Leaderboard
                    entries={entries}
                    onRemove={(id) => setEntries(removeEntry(id))}
                    onClear={() => { clearLeaderboard(); setEntries([]); }}
                    highlightId={highlightId}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="global"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease }}
                >
                  <GlobalLeaderboard />
                </motion.div>
              )}
            </AnimatePresence>

            <footer className="text-center text-xs text-muted pt-6 pb-2">
              {view === "bench"
                ? "测速受网络影响，反映本机当前真实表现"
                : "能力榜为行业参考数据（Artificial Analysis 等），非本机实测"}
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
