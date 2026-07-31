// Cloudflare Worker 入口：导出 Hono app
// 部署: npx wrangler deploy

import { app } from "../server/index";

export default app;
