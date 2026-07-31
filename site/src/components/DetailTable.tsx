import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { BenchResult, Sample } from "../../../bench/types";
import { fmtMs, fmtTps } from "../lib/format";

export function DetailTable({ result }: { result: BenchResult }) {
  const [open, setOpen] = useState(false);

  // 按 provider × prompt 聚合成中位数行
  const rows = result.providers.map((p) => {
    const promptRows = result.prompts.map((pr) => {
      const samples = result.samples.filter(
        (s) => s.provider === p.id && s.promptId === pr.id && s.success,
      );
      const med = (key: keyof Pick<Sample, "ttft" | "tps" | "total">) => {
        const arr = samples.map((s) => s[key]).sort((a, b) => a - b);
        const m = Math.floor(arr.length / 2);
        return arr.length ? (arr.length % 2 ? arr[m] : Math.round((arr[m - 1] + arr[m]) / 2)) : 0;
      };
      return {
        prompt: pr,
        ttft: med("ttft"),
        tps: med("tps"),
        total: med("total"),
        count: samples.length,
      };
    });
    return { provider: p, promptRows };
  });

  return (
    <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-6 cursor-pointer hover:bg-bg transition-colors"
      >
        <h2 className="text-lg font-semibold">明细数据</h2>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-5 h-5 text-muted" />
        </motion.div>
      </button>

      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="overflow-hidden"
      >
        <div className="px-6 pb-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="py-2 pr-4 font-medium">Prompt</th>
                {result.providers.map((p) => (
                  <th key={p.id} className="py-2 px-3 font-medium" style={{ color: p.color }}>
                    {p.name.split(" ")[0]}
                    <div className="text-xs font-normal text-muted">TTFT / TPS / Total</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.prompts.map((pr, ri) => (
                <tr key={pr.id} className={ri % 2 ? "bg-bg/50" : ""}>
                  <td className="py-2 pr-4">{pr.label}</td>
                  {rows.map((r) => {
                    const cell = r.promptRows.find((c) => c.prompt.id === pr.id)!;
                    return (
                      <td key={r.provider.id} className="py-2 px-3 tabular">
                        {cell.count ? (
                          <span className="text-xs">
                            {fmtMs(cell.ttft)} <span className="text-muted">/</span>{" "}
                            {fmtTps(cell.tps)} <span className="text-muted">/</span>{" "}
                            {fmtMs(cell.total)}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
