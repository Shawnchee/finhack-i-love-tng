import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotion } from "../lib/motion";

type Props = {
  words: string[];
  interval?: number;
  className?: string;
};

export default function RotatingWord({
  words,
  interval = 1900,
  className,
}: Props) {
  const [i, setI] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setI((p) => (p + 1) % words.length), interval);
    return () => clearInterval(id);
  }, [interval, words.length, reduced]);

  if (reduced) {
    return <span className={className}>{words[0]}</span>;
  }

  return (
    <span className="relative inline-block overflow-hidden leading-[1em] align-baseline">
      <AnimatePresence mode="wait">
        <motion.span
          key={words[i]}
          initial={{ y: "45%", opacity: 0, filter: "blur(6px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0)" }}
          exit={{ y: "-45%", opacity: 0, filter: "blur(6px)" }}
          transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
          className={`${className ?? ""} inline-block whitespace-nowrap`}
        >
          {words[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
