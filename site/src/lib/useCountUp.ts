import { useEffect, useRef, useState } from "react";

/** 数字 count-up 动效（motion-principles: 400-600ms ease-out） */
export function useCountUp(target: number, duration = 600, decimals = 0) {
  const [value, setValue] = useState(0);
  const ref = useRef<number>(0);
  const reduce = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (reduce.current) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = ref.current;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (target - from) * eased;
      setValue(v);
      ref.current = v;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
