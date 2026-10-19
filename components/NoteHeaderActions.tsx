"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCopy, Copy, Folder, Link2, Lock, LockOpen, MoreHorizontal, MoveHorizontal, Share2, Star, Trash2 } from "lucide-react";
import { deleteNote, duplicateNote, moveNote, setNoteLocked, toggleFavoriteNote } from "@/lib/actions/notes";
import { noteToMarkdown } from "@/lib/notes/text";
import { FloatingPopover } from "@/components/ui/floating-popover";
import { useToast } from "@/components/ui/toast";
import type { Note, Notebook } from "@/lib/db/schema";
import type { NoteAppearance } from "./useNoteAppearance";

const headerButton =
  "flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-50";
const menuItem = "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-neutral-800 disabled:opacity-50";

// Absolute notes link for this app; Orbit has no public sharing, so this only works for people who can open the app.
const noteUrl = (id: string) => `${window.location.origin}/?noteId=${id}`;

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

function formatEdited(updatedAt: Date | string, now: number) {
  const then = new Date(updatedAt);
  const diff = now - then.getTime();
  if (Number.isNaN(then.getTime())) return "";
  if (diff < 60_000) return "Edited just now";
  if (diff < 3_600_000) return `Edited ${Math.floor(diff / 60_000)} min ago`;
  const sameDay = new Date(now).toDateString() === then.toDateString();
  const time = then.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Edited today at ${time}`;
  return `Edited ${then.toLocaleDateString(undefined, { month: "short", day: "numeric", year: then.getFullYear() === new Date(now).getFullYear() ? undefined : "numeric" })}, ${time}`;
}

export function NoteHeaderActions({
  note,
  title,
  notebooks,
  appearance,
  onAppearanceChange,
  getContent,
}: {
  note: Note;
  title: string;
  notebooks: Notebook[];
  appearance: NoteAppearance;
  onAppearanceChange: (patch: Partial<NoteAppearance>) => void;
  // The editor's latest content (what is on screen), which can be ahead of the last saved copy.
  getContent: () => unknown;
}) {
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  // Relative times depend on the clock and locale, so they are only rendered after mount (no SSR mismatch).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const close = () => {
    setOpen(false);
    setMoveOpen(false);
  };

  const run = (failure: string, fn: () => Promise<void>) =>
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        console.error(failure, err);
        toast(failure);
      }
    });

  const copyLink = async () => {
    try {
      await copyText(noteUrl(note.id));
      toast("Link copied. Orbit has no public sharing, so it only opens for people with access to this app.");
    } catch {
      toast("Couldn't copy the link. Your browser blocked clipboard access.");
    }
    close();
  };

  const share = async () => {
    const url = noteUrl(note.id);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: title || "Untitled", url });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return; // cancelled
        // Fall through to copying the link.
      }
    }
    await copyLink();
  };

  const copyNote = async () => {
    try {
      await copyText(noteToMarkdown(title || "Untitled", getContent()));
      toast("Note copied to clipboard");
    } catch {
      toast("Couldn't copy the note. Your browser blocked clipboard access.");
    }
    close();
  };

  const locked = note.isLocked;
  const wide = appearance.width === "wide";

  return (
    <div className="flex items-center gap-1">
      {now !== null && (
        <span
          className="hidden px-1 text-xs text-neutral-500 sm:inline"
          title={`Last saved ${new Date(note.updatedAt).toLocaleString()}`}
        >
          {formatEdited(note.updatedAt, now)}
        </span>
      )}
      {locked && (
        <span className="flex items-center gap-1 px-1 text-xs text-amber-500" role="status">
          <Lock className="h-3 w-3" aria-hidden /> Locked
        </span>
      )}
      <button
        type="button"
        className={`${headerButton} ${note.isFavorite ? "text-amber-400 hover:text-amber-300" : ""}`}
        aria-pressed={note.isFavorite}
        aria-label={note.isFavorite ? "Remove from favorites" : "Add to favorites"}
        title={note.isFavorite ? "Remove from favorites" : "Add to favorites"}
        disabled={isPending}
        onClick={() => run("Couldn't update favorite", () => toggleFavoriteNote(note.id, note.isFavorite))}
      >
        <Star className={`h-3.5 w-3.5 ${note.isFavorite ? "fill-current" : ""}`} />
      </button>
      <button type="button" className={headerButton} aria-label="Share note" title="Share" onClick={share}>
        <Share2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Share</span>
      </button>

      <FloatingPopover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setMoveOpen(false);
        }}
        triggerLabel="Note actions"
        triggerClassName={headerButton}
        trigger={<MoreHorizontal className="h-4 w-4" />}
        align="end"
        className="w-56 py-1"
      >
        <button
          type="button"
          className={menuItem}
          aria-pressed={wide}
          onClick={() => {
            onAppearanceChange({ width: wide ? "standard" : "wide" });
            close();
          }}
        >
          <MoveHorizontal className="h-3.5 w-3.5" />
          Full width
          {wide && <Check className="ml-auto h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          className={menuItem}
          onClick={() => {
            close();
            run(locked ? "Couldn't unlock the note" : "Couldn't lock the note", async () => {
              await setNoteLocked(note.id, !locked);
              toast(locked ? "Note unlocked" : "Note locked. Unlock it from this menu to edit.");
            });
          }}
        >
          {locked ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          {locked ? "Unlock note" : "Lock note"}
        </button>

        <div className="my-1 border-t border-neutral-800" />

        <button type="button" className={menuItem} onClick={copyNote}>
          <ClipboardCopy className="h-3.5 w-3.5" />
          Copy note
        </button>
        <button type="button" className={menuItem} onClick={copyLink}>
          <Link2 className="h-3.5 w-3.5" />
          Copy link
        </button>
        <button
          type="button"
          className={menuItem}
          disabled={isPending}
          onClick={() => {
            close();
            run("Couldn't duplicate the note", async () => {
              const dup = await duplicateNote(note.id);
              if (!dup) throw new Error("Note not found");
              toast("Note duplicated");
              router.push(`/?noteId=${dup.id}`);
            });
          }}
        >
          <Copy className="h-3.5 w-3.5" />
          Duplicate note
        </button>
        <button type="button" className={menuItem} onClick={() => setMoveOpen(!moveOpen)} aria-expanded={moveOpen}>
          <Folder className="h-3.5 w-3.5" />
          Move to notebook
        </button>
        {moveOpen && (
          <div className="mx-2 my-1 max-h-48 overflow-y-auto rounded-md border border-neutral-800 py-1" role="group" aria-label="Notebooks">
            {[{ id: null as string | null, title: "Uncategorized" }, ...notebooks].map((nb) => {
              const current = (note.notebookId ?? null) === nb.id;
              return (
                <button
                  key={nb.id ?? "none"}
                  type="button"
                  disabled={current || isPending}
                  className="flex w-full items-center gap-2 px-3 py-1 text-left text-[11px] text-neutral-200 hover:bg-neutral-800 disabled:text-neutral-500"
                  onClick={() => {
                    close();
                    run("Couldn't move the note", async () => {
                      await moveNote(note.id, nb.id);
                      toast(`Moved to ${nb.title}`);
                    });
                  }}
                >
                  <span className="truncate">{nb.title}</span>
                  {current && <Check className="ml-auto h-3 w-3 shrink-0" aria-label="Current notebook" />}
                </button>
              );
            })}
          </div>
        )}

        <div className="my-1 border-t border-neutral-800" />

        <button
          type="button"
          className={`${menuItem} text-red-500`}
          disabled={isPending}
          onClick={() => {
            close();
            if (!confirm(`Delete "${title.trim() || "Untitled"}"? This can't be undone.`)) return;
            run("Couldn't delete the note", async () => {
              await deleteNote(note.id);
              router.push("/");
            });
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete note
        </button>
      </FloatingPopover>
    </div>
  );
}
