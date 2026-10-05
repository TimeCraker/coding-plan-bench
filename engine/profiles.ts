// 版本化测速 profile（FR-003）：固定 cpb-standard@1 + 纯 TS sha256。
// profile 决定 prompt / maxTokens / temperature / timeout，是结果可比性的前提；
// promptSha256 让任何结果都能追溯到确切的测试输入。

import type { BenchmarkProfile } from "./types";

// ───────────────────────── sha256（纯函数，FIPS 180-4） ─────────────────────────
// 运行时无关：浏览器 / Worker / Node / Tauri 都不能依赖 node:crypto。

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

const encoder = new TextEncoder();

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/** sha256(hex)。输入按 UTF-8 编码（与 node:crypto update(str,"utf8") 一致）。 */
export function sha256Hex(input: string): string {
  const bytes = encoder.encode(input);
  const bitLen = bytes.length * 8;

  // padding: 0x80 + 0x00* + 8 字节 big-endian bit length
  const padded: number[] = [...bytes, 0x80];
  while (padded.length % 64 !== 56) padded.push(0);
  for (let i = 7; i >= 0; i--) padded.push((bitLen / 2 ** (8 * i)) & 0xff);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const w = new Array<number>(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      const j = off + i * 4;
      w[i] =
        ((padded[j] << 24) | (padded[j + 1] << 16) | (padded[j + 2] << 8) | padded[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }

    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((x) => x.toString(16).padStart(8, "0"))
    .join("");
}

// ───────────────────────── 固定 profile ─────────────────────────

/**
 * cpb-standard@1：默认吞吐测试 profile。
 * prompt 要求产出一段带类型标注与 JSDoc 的 TypeScript 工具模块，
 * 稳定输出数百 token，使 TPS 有测量意义（替代 v1 的 "Reply exactly: OK"）。
 */
const CPB_STANDARD_PROMPT = [
  "Write a TypeScript utility module containing three functions:",
  "clamp(n, min, max), lerp(a, b, t), and formatBytes(bytes).",
  "Include full implementations with type annotations and a short JSDoc comment for each function.",
  "After the module, add one usage example per function.",
  "Reply with the module and examples only.",
].join(" ");

export const CPB_STANDARD_PROFILE: BenchmarkProfile = {
  id: "cpb-standard",
  version: 1,
  prompt: CPB_STANDARD_PROMPT,
  promptSha256: sha256Hex(CPB_STANDARD_PROMPT),
  maxTokens: 1024,
  temperature: 0,
  timeoutMs: 90_000,
};

/** 服务端内置 profile 注册表（代理只接受这里的 id+version） */
const PROFILES: ReadonlyMap<string, BenchmarkProfile> = new Map([
  [`${CPB_STANDARD_PROFILE.id}@${CPB_STANDARD_PROFILE.version}`, CPB_STANDARD_PROFILE],
]);

/** id+version 精确匹配才返回 profile；不匹配返回 null（禁止隐式取最新版） */
export function resolveProfile(id: string, version: number): BenchmarkProfile | null {
  return PROFILES.get(`${id}@${version}`) ?? null;
}
