import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Loader2, Eye, EyeOff, Terminal } from "lucide-react";
import type { Protocol } from "../../../engine/types";

export interface FormValues {
  label: string;
  endpoint: string;
  apiKey: string;
  model: string;
  protocol: Protocol;
  samples: number;
}

interface Props {
  onRun: (v: FormValues) => void;
  loading: boolean;
}

const ease = [0.16, 1, 0.3, 1] as const;

export function BenchForm({ onRun, loading }: Props) {
  const [v, setV] = useState<FormValues>({
    label: "", endpoint: "", apiKey: "", model: "",
    protocol: "anthropic", samples: 3,
  });
  const [showKey, setShowKey] = useState(false);
  const set = <K extends keyof FormValues>(k: K, val: FormValues[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.endpoint || !v.apiKey || !v.model) return;
    onRun(v);
  };

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease, delay: 0.4 }}
      className="bg-surface rounded-2xl border border-app shadow-lg-card overflow-hidden"
    >
      {/* 头部 */}
      <div className="px-5 md:px-6 py-4 border-b border-app flex items-center justify-between bg-surface-2/50">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary-soft flex items-center justify-center">
            <Terminal className="w-3.5 h-3.5 text-primary" />
          </div>
          <h2 className="text-[15px] font-semibold text-app">测一个模型</h2>
        </div>
        {/* 协议切换 */}
        <div className="inline-flex bg-surface-2 rounded-lg p-0.5 border border-app">
          {(["anthropic", "openai"] as Protocol[]).map((p) => (
            <button
              key={p} type="button" onClick={() => set("protocol", p)}
              className="relative px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer"
              style={{ color: v.protocol === p ? "#fff" : "var(--text-muted)" }}
            >
              {v.protocol === p && (
                <motion.div layoutId="proto-pill" className="absolute inset-0 rounded-md bg-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }} />
              )}
              <span className="relative">{p === "anthropic" ? "Anthropic" : "OpenAI"}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 表单体 */}
      <div className="p-5 md:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="名称" hint="榜单显示名">
            <input value={v.label} onChange={(e) => set("label", e.target.value)}
              placeholder="智谱 GLM-5.2" className="input" />
          </Field>
          <Field label="Model" hint="模型 ID">
            <input value={v.model} onChange={(e) => set("model", e.target.value)}
              placeholder="glm-5.2" required className="input" />
          </Field>
        </div>

        <Field label="Endpoint URL" hint="API 基础地址">
          <input value={v.endpoint} onChange={(e) => set("endpoint", e.target.value)}
            placeholder={v.protocol === "anthropic"
              ? "https://open.bigmodel.cn/api/anthropic"
              : "https://api.openai.com/v1"}
            required className="input" />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-4">
          <Field label="API Key" hint="仅本次测速，不存储">
            <div className="relative">
              <input type={showKey ? "text" : "password"} value={v.apiKey}
                onChange={(e) => set("apiKey", e.target.value)}
                placeholder="你的 API Key" required className="input pr-10" autoComplete="off" />
              <button type="button" onClick={() => setShowKey((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-app transition-colors cursor-pointer"
                aria-label={showKey ? "隐藏" : "显示"}>
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>
          <Field label="取样" hint="多次取中位数">
            <select value={v.samples} onChange={(e) => set("samples", Number(e.target.value))}
              className="input cursor-pointer">
              <option value={1}>1 次</option>
              <option value={3}>3 次</option>
              <option value={5}>5 次</option>
            </select>
          </Field>
        </div>

        <motion.button
          type="submit"
          disabled={loading || !v.endpoint || !v.apiKey || !v.model}
          whileHover={{ scale: loading ? 1 : 1.01 }}
          whileTap={{ scale: loading ? 1 : 0.99 }}
          className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl bg-primary text-white font-semibold shadow-glow-card hover:bg-primary-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />测速中…</>
          ) : (
            <><Play className="w-4 h-4" fill="currentColor" />开始测速</>
          )}
        </motion.button>
      </div>

      <style>{`
        .input {
          width: 100%; padding: 0.625rem 0.875rem; border-radius: 0.625rem;
          border: 1px solid var(--border); background: var(--surface); color: var(--text);
          font-size: 0.875rem; outline: none; transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input:focus { border-color: var(--primary); box-shadow: 0 0 0 4px var(--primary-soft); }
        .input::placeholder { color: var(--text-muted); opacity: 0.55; }
        select.input { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235a6478' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 0.75rem center; padding-right: 2rem; }
      `}</style>
    </motion.form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[13px] font-semibold text-app">{label}</span>
        {hint && <span className="text-[11px] text-muted">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
