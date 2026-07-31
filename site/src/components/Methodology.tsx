import { Gauge, Info } from "lucide-react";
import type { BenchResult } from "../../../bench/types";
import { fmtTime } from "../lib/format";

export function Methodology({ result }: { result: BenchResult }) {
  return (
    <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">测速方法论</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted">
        <div>
          <h3 className="text-text font-medium mb-1.5">公平性</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>固定 6 条编码 prompt（生成/解释/补全）</li>
            <li>统一 max_tokens=512 / temperature=0</li>
            <li>串行调用，不并发抢带宽</li>
            <li>每家每 prompt 跑 {result.meta.samples} 次取中位数</li>
            <li>流式采集首 token 到达时间</li>
          </ul>
        </div>
        <div>
          <h3 className="text-text font-medium mb-1.5">环境</h3>
          <ul className="space-y-1">
            <li>测速时间：{fmtTime(result.meta.ranAt)}</li>
            <li>运行环境：{result.meta.runner} · {result.meta.node}</li>
            <li>每家每 prompt 取样：{result.meta.samples} 次</li>
            <li>三家均 Anthropic 兼容协议，同套请求代码</li>
          </ul>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-2 p-3 bg-primary-soft rounded-lg text-xs text-text">
        <Gauge className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <span>
          指标说明：<b>TTFT</b> = 首 token 延迟（响应快慢）；<b>TPS</b> = tokens/秒（输出效率）；
          <b>Total</b> = 端到端总耗时。数值受网络环境影响，本地测速反映你当前网络下的真实表现。
        </span>
      </div>
    </div>
  );
}
