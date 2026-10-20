// components/AiFloatingButton.tsx
"use client";

import Link from "next/link";

export function AiFloatingButton({
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
      className={`fixed bottom-6 right-6 w-11 h-11 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 z-50 bg-neutral-300 text-neutral-900 hover:bg-white hover:scale-110 ${
        isAiOpen ? "opacity-0 pointer-events-none scale-90" : "opacity-100 pointer-events-auto"
      }`}
      title="Toggle Orbit AI"
    >
      <svg
        className="w-6 h-6"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="9" cy="9" r="0.8" fill="currentColor" />
        <circle cx="16" cy="9" r="0.8" fill="currentColor" />
        <path d="M7 6c1.5 0 3 1.5 3 3v6c0 1.5 1.5 3 3 3" />
      </svg>
    </Link>
  );
}