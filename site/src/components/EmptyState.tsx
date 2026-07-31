import { Terminal, FileCode2 } from "lucide-react";
import { motion } from "framer-motion";

/** 空状态：首次访问未跑 bench，引导用户 */
export function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="bg-surface rounded-2xl border border-border shadow-sm p-10 text-center"
    >
      <div className="inline-flex w-14 h-14 rounded-2xl bg-primary-soft items-center justify-center mb-4">
        <FileCode2 className="w-7 h-7 text-primary" />
      </div>
      <h2 className="text-xl font-bold">还没有测速数据</h2>
      <p className="mt-2 text-muted max-w-md mx-auto">
        在终端运行测速引擎，生成首次数据后刷新本页即可看到对比。
      </p>
      <div className="mt-5 inline-flex items-center gap-2 bg-bg border border-border rounded-lg px-4 py-2.5 text-sm font-mono">
        <Terminal className="w-4 h-4 text-primary" />
        <span>npm run bench</span>
      </div>
      <p className="mt-3 text-xs text-muted">
        需先 <span className="font-mono">cp .env.example .env</span> 填入三家 API Key
      </p>
    </motion.div>
  );
}
