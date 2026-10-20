"use client";

import { useState, useEffect, useTransition } from "react";
import {
  toggleFavoriteNote,
  duplicateNote,
  moveNote,
  deleteNote,
  updateNote,
} from "@/lib/actions/notes";
import type { Notebook } from "@/lib/db/schema";
import type { NoteSummary } from "@/components/layout/SidebarNav";
import { useRouter } from "next/navigation";
import { ExternalLink, Folder, MoreHorizontal, Copy, Pencil, Star, Trash2 } from "lucide-react";
import { FloatingPopover } from "@/components/ui/floating-popover";

export function NoteActionMenu({
  note,
  notebooks,
  isActive,
}: {
  note: NoteSummary;
  notebooks: Notebook[];
  isActive: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Global Keybindings when note is active
  useEffect(() => {
    if (!isActive) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+D / Cmd+D: Duplicate
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        startTransition(async () => {
          const dup = await duplicateNote(note.id);
          if (dup) router.push(`/?noteId=${dup.id}`);
        });
      }

      // Ctrl+Shift+R / Cmd+Shift+R: Rename
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "r"
      ) {
        e.preventDefault();
        setIsRenaming(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, note.id, router]);

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      await updateNote(note.id, title.trim());
      setIsRenaming(false);
      setIsOpen(false);
    });
  };

  if (isRenaming) {
    return (
      <form onSubmit={handleRenameSubmit} className="flex items-center gap-1">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          onBlur={handleRenameSubmit}
          className="bg-neutral-900 text-white text-xs px-2 py-1 rounded border border-neutral-700 outline-none w-full"
        />
      </form>
    );
  }

  const done = () => {
    setIsOpen(false);
    setIsMoveOpen(false);
  };
  const item = "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-neutral-800 disabled:opacity-50";
  const hint = "ml-auto text-[10px] text-neutral-500";

  return (
    <FloatingPopover
      open={isOpen}
      onOpenChange={(o) => {
        setIsOpen(o);
        if (!o) setIsMoveOpen(false);
      }}
      triggerLabel={`Actions for ${note.title || "Untitled"}`}
      triggerClassName={`rounded p-1 text-neutral-400 transition-opacity hover:bg-neutral-800 hover:text-neutral-100 focus-visible:opacity-100 group-hover:opacity-100 ${isOpen ? "opacity-100" : "opacity-0"}`}
      trigger={<MoreHorizontal className="h-3.5 w-3.5" />}
      align="end"
      className="w-52 py-1"
    >
      <button
        className={item}
        onClick={() =>
          startTransition(async () => {
            await toggleFavoriteNote(note.id, note.isFavorite);
            done();
          })
        }
      >
        <Star className={`h-3.5 w-3.5 ${note.isFavorite ? "fill-current text-amber-400" : ""}`} />
        {note.isFavorite ? "Remove from favorites" : "Add to favorites"}
      </button>

      <button className={item} onClick={() => setIsMoveOpen(!isMoveOpen)} aria-expanded={isMoveOpen}>
        <Folder className="h-3.5 w-3.5" />
        Move to…
      </button>
      {isMoveOpen && (
        <div className="mx-2 my-1 max-h-48 overflow-y-auto rounded-md border border-neutral-800 py-1">
          <button
            className="w-full px-3 py-1 text-left text-[11px] text-neutral-400 hover:bg-neutral-800"
            onClick={() =>
              startTransition(async () => {
                await moveNote(note.id, null);
                done();
              })
            }
          >
            Uncategorized
          </button>
          {notebooks.map((nb) => (
            <button
              key={nb.id}
              className="w-full truncate px-3 py-1 text-left text-[11px] text-neutral-200 hover:bg-neutral-800"
              onClick={() =>
                startTransition(async () => {
                  await moveNote(note.id, nb.id);
                  done();
                })
              }
            >
              {nb.title}
            </button>
          ))}
        </div>
      )}

      <button
        className={item}
        onClick={() =>
          startTransition(async () => {
            const dup = await duplicateNote(note.id);
            done();
            if (dup) router.push(`/?noteId=${dup.id}`);
          })
        }
      >
        <Copy className="h-3.5 w-3.5" />
        Duplicate
        <span className={hint}>Ctrl+D</span>
      </button>

      <button
        className={item}
        onClick={() => {
          setIsRenaming(true);
          done();
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
        Rename
        <span className={hint}>Ctrl+Shift+R</span>
      </button>

      <button
        className={item}
        onClick={() => {
          window.open(`/?noteId=${note.id}`, "_blank");
          done();
        }}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Open in new window
      </button>

      <div className="my-1 border-t border-neutral-800" />

      <button
        className={`${item} text-red-400`}
        onClick={() => {
          if (confirm("Delete this note?")) {
            startTransition(async () => {
              await deleteNote(note.id);
              done();
              router.push("/");
            });
          }
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </button>
    </FloatingPopover>
  );
}
