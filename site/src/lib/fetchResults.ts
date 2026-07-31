// 前端读取测速结果（构建期注入 / 运行期 fetch）
// 纯静态：results.json 与前端同源，fetch 相对路径即可

import type { BenchResult } from "../../../bench/types";

export async function fetchResults(): Promise<BenchResult | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}results.json`, {
      cache: "no-cache",
    });
    if (!res.ok) return null;
    return (await res.json()) as BenchResult;
  } catch {
    return null;
  }
}
