"use client";

import { motion } from "framer-motion";

interface TextEffectProps {
  children: string;
  className?: string;
}

export function TextEffect({ children, className }: TextEffectProps) {
  const words = children.split(" ");

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const wordVariant = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: "easeOut" },
    },
  };

  return (
    <motion.span
      variants={container}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {words.map((word, idx) => (
        <motion.span key={idx} variants={wordVariant} className="inline-block mr-[0.25em]">
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
}