// 测速编排入口：串行遍历 provider × prompt × N 次 → 汇总中位数 → 写 results.json
// 用法: npm run bench
// 可选参数: --samples 5  (覆盖默认 3 次)

import { promises as fsp } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROVIDERS } from "./providers";
import { PROMPTS, BENCH_PARAMS } from "./prompts";
import { benchProviderPrompt } from "./engine";
import type { BenchResult, Sample, ProviderSummary, ProviderId } from "./types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../site/public/results.json");

/** 手写 .env 解析（保持零依赖，不引入 dotenv） */
function loadDotEnv() {
  const envPath = path.resolve(__dirname, "../.env");
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      if (m[1].startsWith("#")) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  } catch {
    // .env 不存在，跳过（靠真实环境变量）
  }
}
loadDotEnv();

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function summarize(samples: Sample[], providers: { id: ProviderId }[]): ProviderSummary[] {
  return providers.map((p) => {
    const ps = samples.filter((s) => s.provider === p.id && s.success);
    const ttft = median(ps.map((s) => s.ttft));
    const tps = median(ps.map((s) => s.tps));
    const total = median(ps.map((s) => s.total));
    // wins: 每个 prompt 上该家 total 中位数是否最小
    const promptIds = [...new Set(ps.map((s) => s.promptId))];
    let wins = 0;
    for (const pid of promptIds) {
      const perProvider = providers.map((pp) => {
        const arr = samples.filter((s) => s.provider === pp.id && s.promptId === pid && s.success);
        return arr.length ? median(arr.map((s) => s.total)) : Infinity;
      });
      const min = Math.min(...perProvider);
      const mine = median(ps.filter((s) => s.promptId === pid).map((s) => s.total));
      if (mine === min) wins++;
    }
    const total0 = samples.filter((s) => s.provider === p.id).length;
    const success = ps.length;
    return {
      provider: p.id,
      ttftMedian: ttft,
      tpsMedian: tps,
      totalMedian: total,
      wins,
      successRate: total0 ? Math.round((success / total0) * 100) : 0,
    };
  });
}

async function main() {
  // 解析 --samples
  const args = process.argv.slice(2);
  let samples: number = BENCH_PARAMS.samples;
  const si = args.indexOf("--samples");
  if (si !== -1 && args[si + 1]) samples = Math.max(1, parseInt(args[si + 1], 10) || samples);

  console.log("");
  console.log("  🏁 Coding Plan Bench — GLM-5.2 测速台");
  console.log(`  ${PROVIDERS.length} 家厂商 × ${PROMPTS.length} prompt × ${samples} 次 = ${PROVIDERS.length * PROMPTS.length * samples} 次调用`);
  console.log(`  参数: max_tokens=${BENCH_PARAMS.maxTokens}, temperature=${BENCH_PARAMS.temperature}, 串行`);
  console.log("");

  const allSamples: Sample[] = [];
  const t0 = performance.now();

  // 串行：一家一家测，避免互相抢带宽
  for (const provider of PROVIDERS) {
    const hasKey = process.env[provider.envVar];
    console.log(`\n▶ ${provider.name}  [${provider.model}]  ${hasKey ? "" : "⚠ 无 key, 跳过"}`);
    if (!hasKey) continue;

    for (const prompt of PROMPTS) {
      process.stdout.write(`  · ${prompt.label.padEnd(16, " ")}`);
      const samples0 = await benchProviderPrompt(provider, prompt.id, prompt.content, samples, (run, sample) => {
        const mark = sample.success ? "✓" : "✗";
        process.stdout.write(` ${mark}${run}:${sample.success ? `${sample.ttft}ms/${sample.tps}tps` : "fail"}`);
      });
      allSamples.push(...samples0);
      console.log("");
    }
  }

  const summary = summarize(allSamples, PROVIDERS);
  const result: BenchResult = {
    meta: {
      ranAt: new Date().toISOString(),
      runner: "local",
      node: process.version,
      samples,
    },
    providers: PROVIDERS,
    prompts: PROMPTS.map((p) => ({ id: p.id, label: p.label, category: p.category })),
    samples: allSamples,
    summary,
  };

  await fsp.mkdir(path.dirname(OUT), { recursive: true });
  await fsp.writeFile(OUT, JSON.stringify(result, null, 2), "utf8");

  const dt = ((performance.now() - t0) / 1000).toFixed(1);
  console.log(`\n✅ 完成 ${dt}s · 写入 ${path.relative(process.cwd(), OUT)}`);
  console.log("");
  console.log("  汇总（中位数）:");
  console.log("  厂商              TTFT     TPS     Total    Wins");
  for (const s of summary) {
    const p = PROVIDERS.find((x) => x.id === s.provider)!;
    console.log(`  ${p.name.padEnd(18, " ")} ${String(s.ttftMedian).padStart(5, " ")}ms  ${String(s.tpsMedian).padStart(5, " ")}  ${String(s.totalMedian).padStart(6, " ")}ms   ${s.wins}`);
  }
  console.log("");
  console.log("  运行 npm run dev 查看可视化结果");
}

main().catch((e) => {
  console.error("\n[X] 测速失败:", e);
  process.exit(1);
});
