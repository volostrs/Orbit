"use client";

import { useTransition } from "react";
import { createNote } from "@/lib/actions/notes";
import { Plus } from "lucide-react";

export function NewNoteButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    startTransition(async () => {
      await createNote(userId);
    });
  };

  return (
    <button
      onClick={handleCreate}
      disabled={isPending}
      className="flex w-full items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-left text-xs font-medium text-neutral-100 transition-colors hover:bg-neutral-800 disabled:opacity-50"
    >
      <Plus className="h-3.5 w-3.5" />
      {isPending ? "Creating…" : "New note"}
    </button>
  );
}