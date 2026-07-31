import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Loader2, Eye, EyeOff } from "lucide-react";
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

export function BenchForm({ onRun, loading }: Props) {
  const [v, setV] = useState<FormValues>({
    label: "",
    endpoint: "",
    apiKey: "",
    model: "",
    protocol: "anthropic",
    samples: 3,
  });
  const [showKey, setShowKey] = useState(false);

  const set = <K extends keyof FormValues>(k: K, val: FormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.endpoint || !v.apiKey || !v.model) return;
    onRun(v);
  };

  return (
    <form
      onSubmit={submit}
      className="bg-surface rounded-2xl border border-app shadow-card p-5 md:p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">测一个模型</h2>
        {/* 协议切换 */}
        <div className="inline-flex bg-surface-2 rounded-lg p-0.5 border border-app">
          {(["anthropic", "openai"] as Protocol[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => set("protocol", p)}
              className="relative px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer"
              style={{
                color: v.protocol === p ? "#fff" : "var(--text-muted)",
              }}
            >
              {v.protocol === p && (
                <motion.div
                  layoutId="proto-pill"
                  className="absolute inset-0 rounded-md bg-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative">
                {p === "anthropic" ? "Anthropic 兼容" : "OpenAI 兼容"}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="名称（可选）" hint="榜单里显示的名字">
          <input
            value={v.label}
            onChange={(e) => set("label", e.target.value)}
            placeholder="如 智谱 GLM-5.2"
            className="input"
          />
        </Field>
        <Field label="Model" hint="模型 id，如 glm-5.2">
          <input
            value={v.model}
            onChange={(e) => set("model", e.target.value)}
            placeholder="glm-5.2"
            required
            className="input"
          />
        </Field>
      </div>

      <Field label="Endpoint URL" hint="API 基础地址">
        <input
          value={v.endpoint}
          onChange={(e) => set("endpoint", e.target.value)}
          placeholder={
            v.protocol === "anthropic"
              ? "https://open.bigmodel.cn/api/anthropic"
              : "https://api.openai.com/v1"
          }
          required
          className="input"
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-4">
        <Field label="API Key" hint="仅用于本次测速，不存储">
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={v.apiKey}
              onChange={(e) => set("apiKey", e.target.value)}
              placeholder="sk-... / ark-... / xxx"
              required
              className="input pr-10"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-app transition-colors cursor-pointer"
              aria-label={showKey ? "隐藏 key" : "显示 key"}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>
        <Field label="取样次数" hint="取中位数">
          <select
            value={v.samples}
            onChange={(e) => set("samples", Number(e.target.value))}
            className="input cursor-pointer"
          >
            <option value={1}>1 次</option>
            <option value={3}>3 次</option>
            <option value={5}>5 次</option>
          </select>
        </Field>
      </div>

      <button
        type="submit"
        disabled={loading || !v.endpoint || !v.apiKey || !v.model}
        className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white font-medium shadow-card hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            测速中…
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            开始测速
          </>
        )}
      </button>

      <style>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .input:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--primary-soft);
        }
        .input::placeholder { color: var(--text-muted); opacity: 0.6; }
      `}</style>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-medium text-app">{label}</span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
