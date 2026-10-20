"use client";

import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";

const EXIT_MS = 160;

// Small, persistent prompt. It stays until the user answers: no timeout and no click-away dismissal.
export function DraftAssistNotification({
  reason,
  onAccept,
  onDecline,
}: {
  reason?: string;
  onAccept: () => void;
  onDecline: (dontShowAgain: boolean) => void;
}) {
  const [dontShow, setDontShow] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const answered = useRef(false);

  // Plays the exit animation, then answers once. (Reduced-motion users have no animation, so the delay is skipped.)
  const answer = (fn: () => void) => {
    if (answered.current) return;
    answered.current = true;
    const animate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animate) return fn();
    setLeaving(true);
    setTimeout(fn, EXIT_MS);
  };

  return (
    <div
      data-testid="draft-assist"
      role="region"
      aria-label="Note improvement suggestion"
      className={`absolute bottom-4 left-4 z-30 w-72 max-w-[calc(100%-2rem)] rounded-lg border border-neutral-800 bg-neutral-900 p-3.5 text-xs text-neutral-300 shadow-lg ${
        leaving ? "orbit-notice-out" : "orbit-notice-in"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="orbit-notice-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 ring-1 ring-inset ring-amber-500/25"
        >
          <Sparkles className="h-4 w-4 text-amber-500" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-medium leading-5 text-neutral-100">Improve this note?</p>
          <p className="line-clamp-2 break-words leading-relaxed text-neutral-500">
            {reason || "Orbit can tighten the wording and structure. Nothing changes until you review it."}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 pl-11">
        <button
          type="button"
          onClick={() => answer(onAccept)}
          className="h-7 rounded-md bg-neutral-100 px-3 font-medium text-neutral-900 transition duration-150 hover:bg-neutral-300 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
        >
          Improve note
        </button>
        <button
          type="button"
          onClick={() => answer(() => onDecline(dontShow))}
          className="h-7 rounded-md px-2.5 text-neutral-400 transition duration-150 hover:bg-neutral-800 hover:text-neutral-100 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
        >
          Not now
        </button>
      </div>

      <label className="mt-3 flex cursor-pointer items-center gap-1.5 border-t border-neutral-800 pt-2.5 text-[11px] text-neutral-500">
        <input type="checkbox" className="h-3 w-3" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
        Don&apos;t suggest this again
      </label>
    </div>
  );
}
