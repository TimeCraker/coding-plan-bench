// Node 运行时入口（自部署备选）：node-server 起 HTTP。
// 用法: npx tsx server/node.ts
// Node 部署额外注入 DNS 解析校验（拒绝私网/loopback 解析结果，防 DNS rebinding）。

import { lookup } from "node:dns/promises";
import { serve } from "@hono/node-server";
import { createApp } from "./index";
import { configFromEnv } from "./config";

const app = createApp({
  config: configFromEnv(process.env),
  dnsLookup: async (hostname) => {
    const res = await lookup(hostname, { all: true });
    return res.map((r) => r.address);
  },
});

serve({ fetch: app.fetch, port: 8787 }, (info) => {
  console.log(`bench API listening on http://localhost:${info.port}`);
});
