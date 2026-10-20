"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { createNote } from "@/lib/actions/notes";
import { createNotebook } from "@/lib/actions/notebooks";
import { useToast } from "@/components/ui/toast";
import type { Notebook } from "@/lib/db/schema";

const field =
  "w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-neutral-400";
const primary =
  "rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-950 transition-colors hover:bg-white disabled:opacity-50";
const secondary =
  "rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-800";

// Shared centred modal. Outside clicks dismiss it only while the name field is empty, so typed text is never lost.
function CreateDialog({
  open,
  onOpenChange,
  title,
  description,
  hasInput,
  onSubmit,
  isPending,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  hasInput: boolean;
  onSubmit: () => void;
  isPending: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} disablePointerDismissal={hasInput}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-[#000000]/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 p-5 text-neutral-100 shadow-xl outline-none">
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
            className="flex flex-col gap-3"
          >
            <div>
              <Dialog.Title className="text-sm font-semibold">{title}</Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-neutral-500">{description}</Dialog.Description>
            </div>
            {children}
            <div className="mt-1 flex justify-end gap-2">
              <button type="button" className={secondary} onClick={() => onOpenChange(false)}>
                Cancel
              </button>
              <button type="submit" disabled={isPending} className={primary}>
                {isPending ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function NewNotebookDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setName("");
      setError("");
    }
  }, [open]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return setError("Enter a notebook name.");
    startTransition(async () => {
      try {
        await createNotebook(userId, trimmed);
        onOpenChange(false);
        toast(`Notebook “${trimmed}” created`);
      } catch {
        setError("Couldn't create the notebook. Try again.");
      }
    });
  };

  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New notebook"
      description="Notebooks group related notes in the sidebar."
      hasInput={name.trim() !== ""}
      onSubmit={submit}
      isPending={isPending}
    >
      <div>
        <input
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          placeholder="Notebook name"
          aria-label="Notebook name"
          aria-invalid={!!error}
          aria-describedby={error ? "new-notebook-error" : undefined}
          className={field}
        />
        {error && (
          <p id="new-notebook-error" role="alert" className="mt-1.5 text-xs text-red-400">
            {error}
          </p>
        )}
      </div>
    </CreateDialog>
  );
}

export function NewNoteDialog({
  open,
  onOpenChange,
  userId,
  notebooks,
  defaultNotebookId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  notebooks: Notebook[];
  defaultNotebookId?: string | null;
}) {
  const [title, setTitle] = useState("");
  const [notebookId, setNotebookId] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  // Reset only when the dialog opens, not when the notebook list refreshes underneath it.
  useEffect(() => {
    if (open) {
      setTitle("");
      setError("");
      setNotebookId(defaultNotebookId && notebooks.some((n) => n.id === defaultNotebookId) ? defaultNotebookId : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return setError("Enter a note title.");
    startTransition(async () => {
      try {
        const created = await createNote(userId, notebookId || undefined, trimmed);
        onOpenChange(false);
        toast(`Note “${trimmed}” created`);
        if (created) router.push(`/?noteId=${created.id}`);
      } catch {
        setError("Couldn't create the note. Try again.");
      }
    });
  };

  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New note"
      description="Give the note a title. You can change it any time."
      hasInput={title.trim() !== ""}
      onSubmit={submit}
      isPending={isPending}
    >
      <div>
        <input
          autoFocus
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError("");
          }}
          placeholder="Note title"
          aria-label="Note title"
          aria-invalid={!!error}
          aria-describedby={error ? "new-note-error" : undefined}
          className={field}
        />
        {error && (
          <p id="new-note-error" role="alert" className="mt-1.5 text-xs text-red-400">
            {error}
          </p>
        )}
      </div>
      {notebooks.length > 0 && (
        <label className="flex flex-col gap-1 text-xs text-neutral-400">
          Notebook
          <select value={notebookId} onChange={(e) => setNotebookId(e.target.value)} className={field}>
            <option value="">None (unfiled)</option>
            {notebooks.map((nb) => (
              <option key={nb.id} value={nb.id}>
                {nb.title}
              </option>
            ))}
          </select>
        </label>
      )}
    </CreateDialog>
  );
}
