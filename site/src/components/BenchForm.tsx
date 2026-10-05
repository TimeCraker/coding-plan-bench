// 测速表单（FR-002）：完整 Request URL + 协议 radio + 样本选择。
// 样式全部静态 Tailwind utility——不注入运行时 <style>（CSP 友好，T-009 沿用）。

import { useState } from "react";
import type { Protocol } from "../../../engine/types";
import { MODEL_MATRIX } from "../../../engine/models";
import { URL_EXAMPLES, URL_FIELD_HINT } from "../content/copy";
import { Play, Eye, EyeOff, Terminal, Zap } from "lucide-react";

export interface FormValues {
  label: string;
  requestUrl: string;
  apiKey: string;
  model: string;
  protocol: Protocol;
  samples: number;
}

interface Props {
  onRun: (v: FormValues) => void;
  busy: boolean;
}

const inputCls =
  "w-full px-3 py-2.5 rounded-xl border bg-surface text-sm text-app placeholder:text-muted/60 outline-none transition-colors focus:border-[var(--primary)] focus:shadow-[0_0_0_4px_var(--primary-soft)]";

/** 模型矩阵 endpoint（base）→ 完整 Request URL */
export function fullRequestUrl(endpoint: string, protocol: Protocol): string {
  const base = endpoint.replace(/\/$/, "");
  return protocol === "anthropic"
    ? `${base}/v1/messages`
    : `${base}/v1/chat/completions`;
}

export function BenchForm({ onRun, busy }: Props) {
  const [v, setV] = useState<FormValues>({
    label: "",
    requestUrl: "",
    apiKey: "",
    model: "",
    protocol: "anthropic",
    samples: 1,
  });
  const [showKey, setShowKey] = useState(false);
  const set = <K extends keyof FormValues>(k: K, val: FormValues[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.requestUrl || !v.apiKey || !v.model) return;
    onRun(v);
  };

  return (
    <form
      onSubmit={submit}
      aria-label="测速表单"
      className="bg-surface rounded-2xl border border-app shadow-lg-card overflow-hidden"
    >
      {/* 头部：标题 + 协议 radio */}
      <div className="px-5 md:px-6 py-4 border-b border-app flex items-center justify-between gap-3 flex-wrap bg-surface-2/50">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary-soft flex items-center justify-center">
            <Terminal className="w-3.5 h-3.5 text-primary" />
          </div>
          <h2 className="text-[15px] font-semibold text-app">测一个模型</h2>
        </div>
        <fieldset className="inline-flex bg-surface-2 rounded-lg p-0.5 border border-app">
          <legend className="sr-only">协议</legend>
          {(["anthropic", "openai"] as Protocol[]).map((p) => (
            <label
              key={p}
              className={`relative px-3 py-1 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                v.protocol === p
                  ? "bg-primary text-white"
                  : "text-muted hover:text-app"
              }`}
            >
              <input
                type="radio"
                name="protocol"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                checked={v.protocol === p}
                onChange={() => set("protocol", p)}
              />
              {p === "anthropic" ? "Anthropic" : "OpenAI"}
            </label>
          ))}
        </fieldset>
      </div>

      {/* 表单体 */}
      <div className="p-5 md:p-6 space-y-4">
        {/* 模型矩阵快选（预填完整 Request URL；key 永不预填） */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted mr-1">
            <Zap className="w-3 h-3" />快选
          </span>
          {MODEL_MATRIX.map((m) => {
            const active = v.model === m.model;
            return (
              <button
                key={m.id}
                type="button"
                title={m.note ?? `预填 ${m.model}`}
                onClick={() =>
                  setV((p) => ({
                    ...p,
                    label: m.name,
                    requestUrl: fullRequestUrl(m.endpoint, m.protocol),
                    model: m.model,
                    protocol: m.protocol,
                  }))
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors cursor-pointer hover:border-primary"
                style={{
                  borderColor: active ? m.color : "var(--border)",
                  color: active ? m.color : "var(--text-muted)",
                  background: active ? `${m.color}14` : "transparent",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: m.color }}
                />
                {m.name}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="显示名" hint="榜单展示，可留空">
            <input
              value={v.label}
              onChange={(e) => set("label", e.target.value)}
              placeholder="如 智谱 GLM-5.3"
              className={inputCls}
            />
          </Field>
          <Field label="Model" hint="模型 ID">
            <input
              value={v.model}
              onChange={(e) => set("model", e.target.value)}
              placeholder="如 glm-5.3"
              required
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Request URL（完整请求地址）" hint={URL_FIELD_HINT}>
          <input
            value={v.requestUrl}
            onChange={(e) => set("requestUrl", e.target.value)}
            placeholder={URL_EXAMPLES[v.protocol]}
            required
            className={`${inputCls} tabular`}
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-4">
          <Field label="API Key" hint="仅本次测速；去向见上方执行位置">
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={v.apiKey}
                onChange={(e) => set("apiKey", e.target.value)}
                placeholder="你的 API Key"
                required
                autoComplete="off"
                className={`${inputCls} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted hover:text-app hover:bg-surface-2 transition-colors cursor-pointer"
                aria-label={showKey ? "隐藏 Key" : "显示 Key"}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>
          <Field label="取样" hint="多次取中位数">
            <select
              value={v.samples}
              onChange={(e) => set("samples", Number(e.target.value))}
              aria-label="取样"
              className={`${inputCls} cursor-pointer`}
            >
              <option value={1}>1 次</option>
              <option value={3}>3 次</option>
              <option value={5}>5 次</option>
            </select>
          </Field>
        </div>

        <button
          type="submit"
          disabled={busy || !v.requestUrl || !v.apiKey || !v.model}
          className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl bg-primary text-white font-semibold shadow-glow-card hover:bg-primary-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Play className="w-4 h-4" fill="currentColor" />
          {busy ? "测速中…" : "开始测速"}
        </button>
      </div>
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
      <span className="flex items-baseline justify-between mb-1.5 gap-2">
        <span className="text-[13px] font-semibold text-app">{label}</span>
        {hint && <span className="text-[11px] text-muted text-right">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
