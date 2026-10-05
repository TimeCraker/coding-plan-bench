// 初始 JS bundle 门禁（AC-010 / NFR-003）：dist 内全部 JS chunk 的 gzip 之和 ≤ 100KB。
// 超预算必须走显式批准（PRD），本脚本按硬门禁执行。
import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ASSETS = path.join(ROOT, "site/dist/assets");
const BUDGET_BYTES = 100 * 1024;

let files;
try {
  files = readdirSync(ASSETS).filter((f) => f.endsWith(".js"));
} catch {
  console.error(`[check-bundle] 缺少 ${ASSETS}——先执行 npm run build`);
  process.exit(1);
}
if (files.length === 0) {
  console.error("[check-bundle] dist/assets 无 JS 产物——先执行 npm run build");
  process.exit(1);
}

let total = 0;
const rows = [];
for (const f of files) {
  const buf = readFileSync(path.join(ASSETS, f));
  const gz = gzipSync(buf, { level: 9 }).length;
  total += gz;
  rows.push({ file: f, raw: statSync(path.join(ASSETS, f)).size, gzip: gz });
}

for (const r of rows) {
  console.log(
    `  ${r.file.padEnd(34)} ${(r.raw / 1024).toFixed(2).padStart(8)} KB  gzip ${(r.gzip / 1024).toFixed(2).padStart(7)} KB`,
  );
}
console.log(
  `  ${"TOTAL".padEnd(34)} ${" ".repeat(8)}  gzip ${(total / 1024).toFixed(2).padStart(7)} KB / ${(BUDGET_BYTES / 1024).toFixed(0)} KB`,
);

if (total > BUDGET_BYTES) {
  console.error(
    `\n[check-bundle] FAIL：初始 JS gzip 超预算（${(total / 1024).toFixed(2)}KB > 100KB）。` +
      ` 需要减重或走显式批准流程（PRD §3 性能）。`,
  );
  process.exit(1);
}
console.log(`\n[check-bundle] PASS`);
