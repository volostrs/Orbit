"use client";

import { useTransition } from "react";
import { createNote } from "@/lib/actions/notes";

export function NewNoteButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    startTransition(async () => {
      const newNote = await createNote(userId);
      console.log("Created note with ID:", newNote.id);
    });
  };

  return (
    <button
      onClick={handleCreate}
      disabled={isPending}
      className="w-full px-3 py-1.5 text-xs font-medium bg-neutral-900 text-neutral-100 hover:bg-neutral-800 border border-neutral-800 rounded transition-colors disabled:opacity-50 text-left"
    >
      {isPending ? "Creating..." : "+ New Note"}
    </button>
  );
}