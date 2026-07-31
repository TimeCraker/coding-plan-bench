import { Shield, Download, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/** 顶部安全提示条：key 不存储 + 本地版入口 */
export function SecurityBanner() {
  const [open, setOpen] = useState(true);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="overflow-hidden bg-primary-soft border-b border-app"
        >
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-2.5 flex items-center gap-2 text-sm">
            <Shield className="w-4 h-4 text-primary shrink-0" />
            <span className="text-app flex-1">
              你的 API Key 仅用于本次测速，不存储不上传，请求结束即丢弃。
            </span>
            <a
              href="https://github.com/TimeCraker/coding-plan-bench/releases"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1 text-primary font-medium hover:underline shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              下载本地版
            </a>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded hover:bg-surface-2 transition-colors text-muted cursor-pointer shrink-0"
              aria-label="关闭提示"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
