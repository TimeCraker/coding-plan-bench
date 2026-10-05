// glm-5.3 模型矩阵对比编排：串行遍历 模型 × 用例 × N 次 → 中位数汇总 → 写 results/data/
// 用法: npm run bench:matrix [-- --samples 3]
// key 只从环境变量 / 仓内 .env（已 gitignore）读取，输出前有泄密守卫

import { promises as fsp } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bench } from "../engine/bench";
import { MODEL_MATRIX, type ModelTarget } from "../engine/models";
import { CASES, BENCH_PARAMS } from "./prompts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../results/data");

/** 手写 .env 解析（保持零依赖，不引入 dotenv） */
function loadDotEnv() {
  const envPath = path.resolve(__dirname, "../.env");
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  } catch {
    // .env 不存在，跳过（靠真实环境变量）
  }
}
loadDotEnv();

interface Sample {
  model: string; // ModelTarget.id
  caseId: string;
  run: number;
  ttft: number;
  tps: number; // output tokens / 生成阶段时长
  total: number;
  outputTokens: number;
  inputTokens: number;
  thinkingMs: number;
  stopReason?: string;
  success: boolean;
  error?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** 跑一次，失败则等 retryDelay 再重试一次（共至多 2 次） */
async function benchWithRetry(target: ModelTarget, prompt: string, maxTokens: number) {
  const input = {
    endpoint: target.endpoint,
    apiKey: process.env[target.envVar]!,
    model: target.model,
    protocol: target.protocol,
    prompt,
    maxTokens,
    temperature: BENCH_PARAMS.temperature,
    timeoutMs: BENCH_PARAMS.timeoutMs,
  };
  let r = await bench(input);
  if (!r.success) {
    console.log(`    ✗ 失败(${r.error?.slice(0, 80)})，${BENCH_PARAMS.retryDelayMs / 1000}s 后重试一次`);
    await sleep(BENCH_PARAMS.retryDelayMs);
    r = await bench(input);
  }
  return r;
}

function toSample(modelId: string, caseId: string, run: number, r: Awaited<ReturnType<typeof bench>>): Sample {
  const genMs = Math.max(1, r.total - r.ttft);
  return {
    model: modelId,
    caseId,
    run,
    ttft: r.ttft,
    tps: r.success ? Math.round((r.outputTokens / genMs) * 1000 * 10) / 10 : 0,
    total: r.total,
    outputTokens: r.outputTokens,
    inputTokens: r.inputTokens,
    thinkingMs: r.thinkingMs,
    stopReason: r.stopReason,
    success: r.success,
    error: r.error,
  };
}

/** 泄密守卫：序列化结果里不得出现任何 key 片段 */
function assertNoSecrets(serialized: string, secrets: string[]) {
  for (const s of secrets) {
    if (s && s.length >= 8 && serialized.includes(s)) {
      throw new Error("输出中检测到 API key，已中止写入");
    }
    if (s && s.length >= 16 && serialized.includes(s.slice(0, 16))) {
      throw new Error("输出中检测到 API key 前缀，已中止写入");
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  let samples: number = BENCH_PARAMS.samples;
  const si = args.indexOf("--samples");
  if (si !== -1 && args[si + 1]) samples = Math.max(1, parseInt(args[si + 1], 10) || samples);

  // 只跑环境里有 key 的模型
  const targets = MODEL_MATRIX.filter((t) => {
    const has = !!process.env[t.envVar];
    if (!has) console.log(`  ⊘ ${t.name} [${t.model}]  无 ${t.envVar}，跳过`);
    return has;
  });
  if (!targets.length) {
    console.error("\n[X] 没有任何模型可用 key，先设置环境变量（见 .env.example）");
    process.exit(1);
  }

  console.log("");
  console.log("  🏁 Coding Plan Bench — glm-5.3 模型矩阵对比");
  console.log(`  ${targets.length} 模型 × ${CASES.length} 用例 × ${samples} 次 = ${targets.length * CASES.length * samples} 次调用（串行，间隔 ${BENCH_PARAMS.delayMs / 1000}s）`);
  console.log(`  参数: max_tokens=${BENCH_PARAMS.maxTokens} temperature=${BENCH_PARAMS.temperature} timeout=${BENCH_PARAMS.timeoutMs / 1000}s`);
  console.log("");

  const allSamples: Sample[] = [];
  const outputs: { model: string; caseId: string; text: string; stopReason?: string }[] = [];
  const secrets = targets.map((t) => process.env[t.envVar]!);
  const t0 = performance.now();

  for (const target of targets) {
    console.log(`\n▶ ${target.name}  [${target.model}]`);
    for (const c of CASES) {
      const maxTokens = c.maxTokens ?? BENCH_PARAMS.maxTokens;
      process.stdout.write(`  · ${c.label.padEnd(14, " ")}`);
      for (let run = 1; run <= samples; run++) {
        if (allSamples.length) await sleep(BENCH_PARAMS.delayMs);
        const r = await benchWithRetry(target, c.content, maxTokens);
        const s = toSample(target.id, c.id, run, r);
        allSamples.push(s);
        if (run === 1 && r.success)
          outputs.push({ model: target.id, caseId: c.id, text: r.text, stopReason: r.stopReason });
        const mark = s.success ? "✓" : "✗";
        process.stdout.write(` ${mark}${run}: ${s.success ? `${s.ttft}ms/${s.total}ms/${s.tps}tps` : "fail"}`);
      }
      console.log("");
    }
  }

  // 汇总：中位数 + 每用例 wins（total 中位数最小者得胜，并列都算）
  const summary = targets.map((t) => {
    const mine = allSamples.filter((s) => s.model === t.id && s.success);
    let wins = 0;
    for (const c of CASES) {
      const perTarget = targets.map((tt) =>
        median(allSamples.filter((s) => s.model === tt.id && s.caseId === c.id && s.success).map((s) => s.total)),
      );
      const my = median(mine.filter((s) => s.caseId === c.id).map((s) => s.total));
      if (perTarget.some((v) => v === 0) && my === 0) continue;
      if (my > 0 && my === Math.min(...perTarget)) wins++;
    }
    const total0 = allSamples.filter((s) => s.model === t.id).length;
    return {
      model: t.id,
      name: t.name,
      ttftMedian: median(mine.map((s) => s.ttft)),
      tpsMedian: median(mine.map((s) => s.tps)),
      totalMedian: median(mine.map((s) => s.total)),
      wins,
      successRate: total0 ? Math.round((mine.length / total0) * 100) : 0,
    };
  });

  const result = {
    meta: {
      ranAt: new Date().toISOString(),
      runner: "local",
      node: process.version,
      samples,
      params: { ...BENCH_PARAMS },
    },
    models: targets, // envVar 字段名可入库（只是变量名，非 secret 值）
    cases: CASES.map(({ id, label, category, level, rubric }) => ({ id, label, category, level, rubric })),
    samples: allSamples,
    outputs,
    summary,
  };

  // 泄密守卫后再落盘
  const serialized = JSON.stringify(result, null, 2);
  assertNoSecrets(serialized, secrets);

  const date = new Date().toISOString().slice(0, 10);
  await fsp.mkdir(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `${date}-model-matrix.json`);
  await fsp.writeFile(outFile, serialized, "utf8");

  const dt = ((performance.now() - t0) / 1000).toFixed(1);
  console.log(`\n✅ 完成 ${dt}s · 写入 ${path.relative(process.cwd(), outFile)}`);
  console.log("");
  console.log("  汇总（中位数）:");
  console.log("  模型                     TTFT      TPS     Total    Wins  成功率");
  for (const s of summary) {
    console.log(
      `  ${s.name.padEnd(20, " ")} ${String(s.ttftMedian).padStart(6, " ")}ms  ${String(s.tpsMedian).padStart(6, " ")}  ${String(s.totalMedian).padStart(7, " ")}ms   ${s.wins}    ${s.successRate}%`,
    );
  }
  console.log("");
}

main().catch((e) => {
  console.error("\n[X] 测速失败:", e);
  process.exit(1);
});
