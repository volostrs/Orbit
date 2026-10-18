"use client";

import { useState, useTransition } from "react";
import { createNotebook, deleteNotebook } from "@/lib/actions/notebooks";
import { Plus, X } from "lucide-react";

export function NewNotebookDialog({ userId }: { userId: string }) {
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    startTransition(async () => {
      await createNotebook(userId, title.trim());
      setTitle("");
      setIsCreating(false);
    });
  };

  if (!isCreating) {
    return (
      <button
        onClick={() => setIsCreating(true)}
        className="flex items-center gap-1 rounded px-1 py-0.5 text-xs text-neutral-500 transition-colors hover:text-neutral-100"
      >
        <Plus className="h-3 w-3" /> Folder
      </button>
    );
  }

  return (
    <form onSubmit={handleCreate} className="mt-1 flex items-center gap-1">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Notebook name"
        autoFocus
        className="w-full min-w-0 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100 outline-none focus:border-neutral-500"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-950 transition-colors hover:bg-white disabled:opacity-50"
      >
        Add
      </button>
      <button
        type="button"
        onClick={() => setIsCreating(false)}
        aria-label="Cancel"
        className="rounded p-1 text-neutral-500 hover:text-neutral-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

export function DeleteNotebookButton({ notebookId }: { notebookId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm("Delete this notebook and all its contents?")) {
          startTransition(async () => {
            await deleteNotebook(notebookId);
          });
        }
      }}
      disabled={isPending}
      className="rounded p-1 text-neutral-500 opacity-0 transition-opacity hover:text-red-400 focus-visible:opacity-100 group-hover:opacity-100"
      title="Delete notebook"
      aria-label="Delete notebook"
    >
      <X className="h-3 w-3" />
    </button>
  );
}