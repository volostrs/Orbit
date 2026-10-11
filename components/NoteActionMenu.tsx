"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import {
  toggleFavoriteNote,
  duplicateNote,
  moveNote,
  deleteNote,
  updateNote,
} from "@/lib/actions/notes";
import type { Note, Notebook } from "@/lib/db/schema";
import { useRouter } from "next/navigation";

export function NoteActionMenu({
  note,
  notebooks,
  isActive,
}: {
  note: Note;
  notebooks: Notebook[];
  isActive: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [title, setTitle] = useState(note.title);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsMoveOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      await updateNote(note.id, title, note.content, note.notebookId);
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

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="opacity-0 group-hover:opacity-100 px-1 py-0.5 text-neutral-400 hover:text-white text-xs rounded hover:bg-neutral-800 transition-opacity"
      >
        •••
      </button>

      {isOpen && (
        <div className="absolute right-0 top-6 w-48 bg-neutral-950 border border-neutral-800 rounded shadow-xl py-1 z-50 text-xs text-neutral-300">
          {/* Favorite */}
          <button
            onClick={() => {
              startTransition(async () => {
                await toggleFavoriteNote(note.id, note.isFavorite);
                setIsOpen(false);
              });
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 flex items-center justify-between"
          >
            <span>{note.isFavorite ? "★ Favorited" : "☆ Add to Favorites"}</span>
          </button>

          {/* Move To */}
          <div className="relative">
            <button
              onClick={() => setIsMoveOpen(!isMoveOpen)}
              className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 flex items-center justify-between"
            >
              <span>📁 Move to...</span>
              <span className="text-neutral-500 text-[10px]">Ctrl+Shift+P</span>
            </button>

            {isMoveOpen && (
              <div className="bg-neutral-900 border border-neutral-800 rounded py-1 my-1 mx-2">
                <button
                  onClick={() => {
                    startTransition(async () => {
                      await moveNote(note.id, null);
                      setIsOpen(false);
                    });
                  }}
                  className="w-full text-left px-3 py-1 text-[11px] hover:bg-neutral-800 text-neutral-400"
                >
                  Uncategorized
                </button>
                {notebooks.map((nb) => (
                  <button
                    key={nb.id}
                    onClick={() => {
                      startTransition(async () => {
                        await moveNote(note.id, nb.id);
                        setIsOpen(false);
                      });
                    }}
                    className="w-full text-left px-3 py-1 text-[11px] hover:bg-neutral-800 text-neutral-200 truncate"
                  >
                    📁 {nb.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Duplicate */}
          <button
            onClick={() => {
              startTransition(async () => {
                const dup = await duplicateNote(note.id);
                setIsOpen(false);
                if (dup) router.push(`/?noteId=${dup.id}`);
              });
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 flex items-center justify-between"
          >
            <span>📋 Duplicate</span>
            <span className="text-neutral-500 text-[10px]">Ctrl+D</span>
          </button>

          {/* Rename */}
          <button
            onClick={() => {
              setIsRenaming(true);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 flex items-center justify-between"
          >
            <span>✏️ Rename</span>
            <span className="text-neutral-500 text-[10px]">Ctrl+Shift+R</span>
          </button>

          {/* Open in New Window */}
          <button
            onClick={() => {
              window.open(`/?noteId=${note.id}`, "_blank");
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 flex items-center justify-between"
          >
            <span>↗️ Open in new window</span>
          </button>

          <div className="border-t border-neutral-800 my-1"></div>

          {/* Delete */}
          <button
            onClick={() => {
              if (confirm("Delete this note?")) {
                startTransition(async () => {
                  await deleteNote(note.id);
                  setIsOpen(false);
                  router.push("/");
                });
              }
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-neutral-900 text-red-400 flex items-center justify-between"
          >
            <span>🗑️ Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}