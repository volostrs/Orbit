"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";

export function AiSidebarToggle({
  isAiOpen,
  activeNoteId,
}: {
  isAiOpen: boolean;
  activeNoteId?: string;
}) {
  const nextState = !isAiOpen;
  const href = `/?${activeNoteId ? `noteId=${activeNoteId}&` : ""}aiOpen=${nextState}`;

  return (
    <Link
      href={href}
      title="Toggle Orbit AI (Ctrl+.)"
      className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
        isAiOpen
          ? "bg-neutral-800 text-neutral-100"
          : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
      }`}
    >
      <div className="w-5 h-5 rounded-md bg-neutral-900 border border-neutral-700 flex items-center justify-center shrink-0">
        <Sparkles className="w-3 h-3 text-amber-400" />
      </div>
      <span className="truncate">Orbit AI</span>
      <kbd className="ml-auto font-sans text-[10px] text-neutral-500">Ctrl+.</kbd>
    </Link>
  );
}