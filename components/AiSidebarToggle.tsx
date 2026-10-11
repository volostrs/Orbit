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
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
        isAiOpen
          ? "bg-neutral-800 text-white"
          : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
      }`}
    >
      <div className="w-5 h-5 rounded-md bg-neutral-900 border border-neutral-700 flex items-center justify-center shrink-0">
        <Sparkles className="w-3 h-3 text-amber-400" />
      </div>
      <span className="truncate">Orbit AI</span>
    </Link>
  );
}