interface GlowProps {
  className?: string;
}

export function Glow({ className = "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" }: GlowProps) {
  return (
    <div
      className={`absolute w-[600px] h-[220px] bg-purple-500/30 dark:bg-purple-600/35 blur-3xl rounded-3xl pointer-events-none z-0 ${className}`}
    />
  );
}