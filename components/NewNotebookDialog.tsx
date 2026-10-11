"use client";

import { useState, useTransition } from "react";
import { createNotebook, deleteNotebook } from "@/lib/actions/notebooks";

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
        className="text-xs text-neutral-500 hover:text-white transition-colors flex items-center gap-1 font-mono"
      >
        + Folder
      </button>
    );
  }

  return (
    <form onSubmit={handleCreate} className="flex gap-1 mt-1">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Notebook name..."
        autoFocus
        className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 text-xs text-white rounded focus:outline-none"
      />
      <button
        type="submit"
        disabled={isPending}
        className="px-2 py-1 bg-neutral-200 text-black text-xs font-semibold rounded hover:bg-white"
      >
        Add
      </button>
      <button
        type="button"
        onClick={() => setIsCreating(false)}
        className="px-2 py-1 text-neutral-500 hover:text-white text-xs"
      >
        ✕
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
      className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400 text-xs px-1"
      title="Delete Notebook"
    >
      ✕
    </button>
  );
}