// 服务端环境配置接口（Worker vars / Node env 同构读取）。
// CORS_ALLOWED_ORIGINS：精确 origin 列表（scheme://host[:port]），逗号分隔。
// ALLOWED_UPSTREAMS：结构化 host|pathPrefix，逗号分隔；host 为解析后的 ASCII hostname。

export interface AllowedUpstream {
  host: string;
  pathPrefix: string;
}

export interface ServerConfig {
  /** 允许跨域调用 /api/bench 的站点 origin（精确匹配，不用 *） */
  corsAllowedOrigins: string[];
  /** 允许访问的上游（host 精确匹配 + path 前缀） */
  allowedUpstreams: AllowedUpstream[];
  /** 请求体上限（Spec §4.2：≤16 KiB） */
  maxBodyBytes: number;
  /** 单请求总墙钟硬 cap（profile timeout × samples 之上再设服务器上限） */
  hardTimeoutMs: number;
}

function splitCsv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** 解析 ALLOWED_UPSTREAMS：`host|pathPrefix` 条目；格式非法的条目丢弃并告警 */
export function parseAllowedUpstreams(value: string | undefined): AllowedUpstream[] {
  const out: AllowedUpstream[] = [];
  for (const entry of splitCsv(value)) {
    const [host, pathPrefix] = entry.split("|");
    if (!host || pathPrefix === undefined) {
      console.warn(`[config] 忽略非法 ALLOWED_UPSTREAMS 条目: <redacted>`);
      continue;
    }
    out.push({
      host: host.trim().toLowerCase(),
      pathPrefix: pathPrefix.trim(),
    });
  }
  return out;
}

export function configFromEnv(env: Record<string, string | undefined>): ServerConfig {
  return {
    corsAllowedOrigins: splitCsv(env.CORS_ALLOWED_ORIGINS).map((o) =>
      o.replace(/\/$/, ""),
    ),
    allowedUpstreams: parseAllowedUpstreams(env.ALLOWED_UPSTREAMS),
    maxBodyBytes: 16 * 1024,
    hardTimeoutMs: 5 * 60_000,
  };
}
