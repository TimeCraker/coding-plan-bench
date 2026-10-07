// 测速表单（FR-002）：完整 Request URL + 协议 radio + 样本选择。
// 样式全部静态 Tailwind utility——不注入运行时 <style>（CSP 友好，T-009 沿用）。
// Swiss Industrial Print：墨线面板 · 珊瑚单强调 · mono 描边快选芯片 · 分段控制，零圆角零图标。

import { useState } from "react";
import type { Protocol } from "../../../engine/types";
import { MODEL_MATRIX } from "../../../engine/models";
import { URL_EXAMPLES, URL_FIELD_HINT } from "../content/copy";

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
  "w-full px-3 py-2.5 border border-line bg-panel text-sm text-ink placeholder:text-ink-3 transition-colors duration-150 ease-(--ease) focus:border-accent";

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

  const incomplete = !v.requestUrl || !v.apiKey || !v.model;

  return (
    <form
      onSubmit={submit}
      aria-label="测速表单"
      className="bg-panel border-[1.5px] border-ink hard-shadow"
    >
      {/* 头部：珊瑚方标 + 标题 + 协议分段控制 */}
      <div className="px-5 md:px-6 py-4 border-b border-line flex items-center justify-between gap-3 flex-wrap bg-panel-2">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="w-2 h-2 bg-accent" />
          <h2 className="font-disp text-[15px] font-semibold text-ink">测一个模型</h2>
        </div>
        <fieldset className="inline-flex border border-ink bg-panel min-w-0">
          <legend className="sr-only">协议</legend>
          {(["anthropic", "openai"] as Protocol[]).map((p, i) => (
            <label
              key={p}
              className={`relative px-4 py-1.5 text-xs font-semibold cursor-pointer transition-colors duration-150 ease-(--ease)${
                i > 0 ? " border-l border-line" : ""
              } ${
                v.protocol === p
                  ? "bg-ink text-paper"
                  : "text-ink-2 bg-panel hover:bg-panel-2"
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

      {/* 表单体：快选区与请求定义区以发丝线分节 */}
      <div className="p-5 md:p-6 space-y-5">
        {/* 模型矩阵快选（预填完整 Request URL；key 永不预填） */}
        <section className="space-y-2.5">
          <SecHead tag="MODEL PRESET" sub="快选 · 点击预填 URL 与模型，Key 不预填" />
          <div className="flex flex-wrap items-center gap-1.5">
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
                  className={`inline-flex items-center px-2.5 py-1 font-mono text-[11px] border transition-colors duration-150 ease-(--ease) cursor-pointer ${
                    active
                      ? "border-accent text-accent bg-accent/10"
                      : "border-line-2 text-ink-2 bg-panel hover:bg-ink hover:text-paper hover:border-ink"
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <SecHead tag="REQUEST" sub="请求定义" />
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
                className={`${inputCls} font-mono`}
              />
            </Field>
          </div>

          <Field label="Request URL（完整请求地址）" hint={URL_FIELD_HINT}>
            <input
              value={v.requestUrl}
              onChange={(e) => set("requestUrl", e.target.value)}
              placeholder={URL_EXAMPLES[v.protocol]}
              required
              className={`${inputCls} font-mono`}
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
                  className={`${inputCls} pr-20`}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 font-mono text-[11px] text-ink-2 bg-panel-2 border border-line-2 cursor-pointer transition-colors duration-150 ease-(--ease) hover:bg-ink hover:text-paper hover:border-ink"
                  aria-label={showKey ? "隐藏 Key" : "显示 Key"}
                >
                  {showKey ? "隐藏 Key" : "显示 Key"}
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
        </section>

        {/* 提交区：墨底纸字主按钮 + 必填红轨提示 */}
        <div className="pt-4 border-t border-line flex flex-col md:flex-row md:items-center gap-3">
          <button
            type="submit"
            disabled={busy || incomplete}
            className="w-full md:w-auto inline-flex items-center justify-center px-8 py-3 bg-ink text-paper text-sm font-semibold hard-shadow cursor-pointer transition-colors duration-150 ease-(--ease) hover:bg-accent active:translate-y-[1px] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? "测速中…" : "开始测速"}
          </button>
          {incomplete && (
            <p className="border-l-2 border-bad pl-2.5 text-xs text-bad">
              Request URL / API Key / Model 为必填
            </p>
          )}
        </div>
      </div>
    </form>
  );
}

/** 区块标题：mono 大写标签 + 右侧发丝延伸线（agent-hive .sec>h2 同构） */
function SecHead({ tag, sub }: { tag: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className="lbl-mono whitespace-nowrap">{tag}</span>
      {sub && <span className="text-[11px] text-ink-3 whitespace-nowrap">{sub}</span>}
      <span aria-hidden="true" className="h-px flex-1 bg-line-2" />
    </div>
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
    <label className="block min-w-0">
      <span className="flex items-baseline justify-between mb-1.5 gap-2">
        <span className="text-[13px] font-semibold text-ink">{label}</span>
        {hint && <span className="text-[11px] text-ink-3 text-right">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
