// 顶部安全说明（AC-008）：不再无条件承诺"不上传"——
// Key 路径由用户选择的执行位置决定，文案与 TransportSelector 的事实一致。

import { Shield, Download, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SECURITY_BANNER } from "../content/copy";

export function SecurityBanner() {
  const [open, setOpen] = useState(true);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden bg-primary-soft/60 border-b border-app backdrop-blur-sm"
        >
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-2.5 flex items-center gap-2.5 text-[13px]">
            <Shield
              className="w-4 h-4 text-primary shrink-0"
              strokeWidth={2}
              aria-hidden="true"
            />
            <span className="text-app flex-1 min-w-0">{SECURITY_BANNER}</span>
            <a
              href="https://github.com/TimeCraker/coding-plan-bench/releases"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-primary font-semibold hover:underline shrink-0"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              下载本地版
            </a>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-md hover:bg-surface transition-colors text-muted cursor-pointer shrink-0"
              aria-label="关闭安全说明"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
