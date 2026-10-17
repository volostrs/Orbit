"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

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
  return (
    <div
      data-testid="draft-assist"
      role="region"
      aria-label="Note improvement suggestion"
      className="absolute bottom-4 left-4 z-30 w-72 rounded-xl border border-neutral-800 bg-neutral-900/95 p-3 shadow-xl backdrop-blur text-xs text-neutral-200"
    >
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
        <div>
          <p className="font-medium text-white">Would you like help improving this note?</p>
          {reason && <p className="mt-0.5 text-neutral-500">{reason}</p>}
        </div>
      </div>
      <label className="mt-2 flex cursor-pointer items-center gap-2 text-neutral-400">
        <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
        Don&apos;t show this again
      </label>
      <div className="mt-2 flex gap-2">
        <button
          onClick={onAccept}
          className="flex-1 rounded-lg bg-amber-500 px-2.5 py-1.5 font-medium text-black transition-colors hover:bg-amber-400"
        >
          Help improve this note
        </button>
        <button
          onClick={() => onDecline(dontShow)}
          className="rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-neutral-300 transition-colors hover:bg-neutral-800"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
