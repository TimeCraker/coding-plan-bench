// 验证后工作区 clean 检查（AC-011）：tracked 文件无未声明改动、无非忽略 untracked 产物。
// git status --porcelain 不显示 ignored 文件（dist/test-results 等已 gitignore）。
import { execFileSync } from "node:child_process";

let out;
try {
  out = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" });
} catch (e) {
  console.error("[check-clean] git status 执行失败：", e.message);
  process.exit(1);
}

if (out.trim() === "") {
  console.log("[check-clean] PASS：验证后工作区 clean");
  process.exit(0);
}

console.error("[check-clean] FAIL：验证产生了未声明的 tracked/untracked 改动：");
for (const line of out.split("\n")) {
  if (line.trim()) console.error(`  ${line}`);
}
console.error(
  "\n处理方式：在对应 Task 范围内修正确定性输出，或记录 blocker；不得静默清理用户文件。",
);
process.exit(1);
