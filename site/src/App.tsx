import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Terminal, Github, RefreshCw } from "lucide-react";
import type { BenchResult } from "../../bench/types";
import { fetchResults } from "./lib/fetchResults";
import { OverviewCards } from "./components/OverviewCards";
import { ComparisonChart } from "./components/ComparisonChart";
import { DetailTable } from "./components/DetailTable";
import { Methodology } from "./components/Methodology";
import { Skeleton } from "./components/Skeleton";
import { EmptyState } from "./components/EmptyState";
import { fmtTime } from "./lib/format";

export default function App() {
  const [result, setResult] = useState<BenchResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetchResults().then((r) => {
      setResult(r && r.samples.length ? r : null);
      setLoading(false);
    });
  };

  useEffect(load, []);

  return (
    <div className="min-h-screen">
      {/* 顶栏：backdrop-blur 浮动 */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-surface/80 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight">Coding Plan Bench</h1>
              <p className="text-[11px] text-muted leading-tight">GLM-5.2 订阅套餐测速台</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {result && (
              <span className="hidden sm:inline text-xs text-muted tabular">
                {fmtTime(result.meta.ranAt)}
              </span>
            )}
            <button
              onClick={load}
              title="刷新数据"
              className="p-2 rounded-lg hover:bg-bg transition-colors cursor-pointer text-muted"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <a
              href="https://github.com/TimeCraker/coding-plan-bench"
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg hover:bg-bg transition-colors cursor-pointer text-muted"
            >
              <Github className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 pt-10 pb-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            同样问 GLM-5.2，<span className="text-primary">哪家套餐更快？</span>
          </h2>
          <p className="mt-2 text-muted max-w-2xl">
            对比智谱 / 火山方舟 / 百度千帆三家订阅套餐的真实响应速度与 token 输出效率。
            流式采集首 token 延迟（TTFT）与输出速度（TPS），可复现。
          </p>
        </motion.div>
      </section>

      {/* 主体 */}
      <main className="max-w-6xl mx-auto px-4 md:px-6 pb-16 space-y-6">
        {loading ? (
          <Skeleton />
        ) : !result ? (
          <EmptyState />
        ) : (
          <>
            <OverviewCards result={result} />
            <ComparisonChart result={result} />
            <DetailTable result={result} />
            <Methodology result={result} />
            <footer className="text-center text-xs text-muted pt-4">
              <p>
                测速受网络环境影响，数据反映本机当前网络下的真实表现 ·{" "}
                <span className="font-mono">npm run bench</span> 重新测速
              </p>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
