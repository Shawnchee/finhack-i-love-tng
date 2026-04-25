import { motion } from "framer-motion";
import { useReducedMotion } from "../lib/motion";

type Props = {
  text: string;
  className?: string;
  delay?: number;
  by?: "word" | "letter";
};

export default function BlurText({
  text,
  className,
  delay = 0,
  by = "word",
}: Props) {
  const reduced = useReducedMotion();
  const items = by === "word" ? text.split(" ") : text.split("");

  if (reduced) return <span className={className}>{text}</span>;

  return (
    <span className={className} aria-label={text}>
      {items.map((chunk, i) => (
        <motion.span
          key={i}
          initial={{ filter: "blur(12px)", opacity: 0, y: 6 }}
          animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
          transition={{
            duration: 0.55,
            delay: delay + i * 0.05,
            ease: [0.25, 1, 0.5, 1],
          }}
          style={{ display: "inline-block", whiteSpace: "pre" }}
          aria-hidden
        >
          {chunk}
          {by === "word" && i < items.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </span>
  );
}
