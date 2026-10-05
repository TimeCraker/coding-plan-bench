// Cloudflare Worker 入口：从 Worker env（wrangler.toml [vars] / secrets）解析配置。
// 部署: npx wrangler deploy

import { createApp } from "../server/index";
import { configFromEnv } from "../server/config";

export interface Env {
  CORS_ALLOWED_ORIGINS?: string;
  ALLOWED_UPSTREAMS?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const app = createApp({ config: configFromEnv(env as Record<string, string | undefined>) });
    return app.fetch(request);
  },
};
