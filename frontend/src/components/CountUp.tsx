import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../lib/motion";

type Props = {
  to: number;
  duration?: number;
  className?: string;
  format?: (n: number) => string;
  trigger?: "mount" | "inview";
};

export default function CountUp({
  to,
  duration = 1200,
  className,
  format = (n) => Math.round(n).toLocaleString(),
  trigger = "inview",
}: Props) {
  const [value, setValue] = useState(0);
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (reduced) {
      setValue(to);
      return;
    }
    const start = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      const startTs = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - startTs) / duration);
        const eased = 1 - Math.pow(1 - p, 4);
        setValue(to * eased);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    if (trigger === "mount") {
      start();
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) start();
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [to, duration, trigger, reduced]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
