import { useEffect, useRef, useState } from "react";

/** 数字 count-up 动效（motion-principles: 400-600ms ease-out）；reduced-motion 直接落位 */
export function useCountUp(target: number, duration = 600, decimals = 0) {
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [value, setValue] = useState(() => (reduce ? target : 0));
  const ref = useRef(reduce ? target : 0);

  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const start = performance.now();
    const from = ref.current;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = from + (target - from) * eased;
      setValue(val);
      ref.current = val;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduce]);

  // reduced-motion：不调度任何 JS 动画，直接返回目标值
  const resolved = reduce ? target : value;
  const factor = Math.pow(10, decimals);
  return Math.round(resolved * factor) / factor;
}
