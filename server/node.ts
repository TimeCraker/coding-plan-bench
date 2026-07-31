// Node 运行时入口（你服务器备选部署用）：node-server 起 HTTP
// 用法: npx tsx server/node.ts  (或编译后 node server/node.js)

import { serve } from "@hono/node-server";
import { app } from "./index";

serve({ fetch: app.fetch, port: 8787 }, (info) => {
  console.log(`bench API listening on http://localhost:${info.port}`);
});
