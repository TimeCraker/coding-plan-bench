import { motion } from "framer-motion";

/** 骨架屏 shimmer（content-jumping 规则：加载时占位防跳动） */
export function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-surface rounded-2xl border border-border shadow-sm p-5 h-36 overflow-hidden relative">
            <Shimmer />
          </div>
        ))}
      </div>
      <div className="bg-surface rounded-2xl border border-border shadow-sm p-6 h-72 overflow-hidden relative">
        <Shimmer />
      </div>
    </div>
  );
}

function Shimmer() {
  return (
    <motion.div
      className="absolute inset-0"
      style={{
        background:
          "linear-gradient(90deg, transparent, rgba(148,163,184,0.12), transparent)",
      }}
      animate={{ x: ["-100%", "100%"] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
    />
  );
}
