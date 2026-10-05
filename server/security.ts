// 代理边界安全（FR-007 / AC-004 / AUD-002 根治）：
// - Origin 精确 allowlist；无 Origin 的写操作显式拒绝（curl 只能打 /api/health）
// - 上游 host+path 结构化 allowlist；hostname ASCII 小写精确比较，杜绝 suffix 欺骗
// - 拒绝 IP literal / localhost / .local / 非标准端口
// - Node 部署额外做 DNS 解析并拒绝 private/loopback/link-local 结果（防 DNS rebinding）

import type { AllowedUpstream, ServerConfig } from "./config";

/**
 * Origin 校验：精确匹配（scheme+host+port 全等）。无 Origin 的一律不允许写操作——
 * 这是显式规则：非浏览器客户端（curl）只能访问 /api/health，不能用 /api/bench。
 */
export function isOriginAllowed(
  origin: string | undefined,
  config: Pick<ServerConfig, "corsAllowedOrigins">,
): boolean {
  if (!origin) return false;
  return config.corsAllowedOrigins.includes(origin);
}

/** 是否 IP literal（IPv4 / IPv6 / [IPv6]） */
export function isIpLiteral(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "");
  if (h.includes(":")) return true; // IPv6
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true; // IPv4
  // 十进制/十六进制整数形式 IP（如 0x7f000001）
  if (/^(0x)?\d+$/.test(h) && !h.includes(".")) return true;
  return false;
}

/** 本地/内网命名目标 */
export function isLocalName(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal");
}

/**
 * 上游 allowlist 校验：hostname 精确相等（==，不是 endsWith，无 suffix 欺骗），
 * pathname 必须以配置的 pathPrefix 开头。
 */
export function findAllowedUpstream(
  url: URL,
  allowed: readonly AllowedUpstream[],
): AllowedUpstream | null {
  const host = url.hostname.toLowerCase();
  const path = url.pathname;
  for (const u of allowed) {
    if (u.host === host && (path === u.pathPrefix || path.startsWith(u.pathPrefix.endsWith("/") ? u.pathPrefix : `${u.pathPrefix}/`))) {
      return u;
    }
  }
  return null;
}

/** 代理禁命中：IP literal、本地名、非 443 端口（URL 结构层面可判定的全部拒绝） */
export function proxyTargetViolation(url: URL): string | null {
  if (isIpLiteral(url.hostname)) return "IP 地址目标被拒绝";
  if (isLocalName(url.hostname)) return "本地网络目标被拒绝";
  if (url.port !== "" && url.port !== "443") return "非标准端口被拒绝";
  return null;
}

/** IPv4 数值 → 32bit */
function ipv4ToLong(ip: string): number {
  const parts = ip.split(".").map((p) => Number.parseInt(p, 10));
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToLong(ip);
  const inRange = (base: string, bits: number) => {
    const b = ipv4ToLong(base);
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (n & mask) === (b & mask);
  };
  return (
    inRange("10.0.0.0", 8) ||
    inRange("172.16.0.0", 12) ||
    inRange("192.168.0.0", 16) ||
    inRange("127.0.0.0", 8) || // loopback
    inRange("169.254.0.0", 16) || // link-local
    inRange("0.0.0.0", 8) ||
    inRange("100.64.0.0", 10) // CGNAT
  );
}

function isPrivateIpv6(hostNoBrackets: string): boolean {
  const h = hostNoBrackets.toLowerCase();
  if (h === "::1" || h === "::") return true;
  if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  // IPv4-mapped (::ffff:10.0.0.1)
  const v4mapped = h.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4mapped) return isPrivateIpv4(v4mapped[1]);
  return false;
}

/**
 * DNS 解析结果私网校验（Node 部署用；Worker 出口不受本机 DNS rebinding 影响）。
 * 解析出的任一地址为 private/loopback/link-local 即拒绝。
 */
export function dnsResultIsPrivate(addresses: readonly string[]): boolean {
  return addresses.some((addr) => {
    const a = addr.replace(/^\[|\]$/g, "");
    if (a.includes(":")) return isPrivateIpv6(a);
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(a)) return isPrivateIpv4(a);
    return false;
  });
}
