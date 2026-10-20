"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Folder,
  FolderOpen,
  LayoutDashboard,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import type { Note, Notebook } from "@/lib/db/schema";
import { deleteNotebook, renameNotebook } from "@/lib/actions/notebooks";
import { DynamicIcon } from "@/components/ui/DynamicIcon";
import { NewNoteDialog, NewNotebookDialog } from "@/components/notes/CreateDialogs";
import { NoteActionMenu } from "@/components/notes/NoteActionMenu";
import { FloatingPopover } from "@/components/ui/floating-popover";

export type NoteSummary = Omit<Note, "content">;
export type SidebarView = "dashboard" | "calendar" | "chats" | null;

const sectionLabel = "px-1 text-[11px] font-medium uppercase tracking-wider text-neutral-500";
const COLLAPSED_KEY = "orbit:collapsed-notebooks";

export function SidebarNav({
  userId,
  notes,
  notebooks,
  activeNoteId,
  isAiOpen,
  view,
}: {
  userId: string;
  notes: NoteSummary[];
  notebooks: Notebook[];
  activeNoteId?: string;
  isAiOpen: boolean;
  view: SidebarView;
}) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();

  // Remember which notebooks are collapsed (per browser). Read after mount so SSR markup matches.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLLAPSED_KEY) || "[]");
      if (Array.isArray(saved)) setCollapsed(new Set(saved.filter((v) => typeof v === "string")));
    } catch {}
  }, []);

  const updateCollapsed = (fn: (next: Set<string>) => void) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      fn(next);
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  // Ctrl/Cmd + Shift + F focuses search from anywhere (Ctrl+K is taken by the editor's link shortcut).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The Dashboard's search button focuses this same search box (after the drawer has opened on narrow screens).
  useEffect(() => {
    const focus = () =>
      setTimeout(() => {
        searchRef.current?.focus();
        searchRef.current?.select();
      }, 50);
    window.addEventListener("orbit:focus-search", focus);
    return () => window.removeEventListener("orbit:focus-search", focus);
  }, []);

  const noteHref = (id: string) => `/?noteId=${id}${isAiOpen ? "&aiOpen=true" : ""}`;
  const notebookName = useMemo(() => new Map(notebooks.map((nb) => [nb.id, nb.title])), [notebooks]);

  const matchedNotebooks = q ? notebooks.filter((nb) => nb.title.toLowerCase().includes(q)) : [];
  const matchedNotes = q ? notes.filter((n) => (n.title || "Untitled").toLowerCase().includes(q)) : [];

  const row = (note: NoteSummary) => (
    <NoteRow
      key={note.id}
      note={note}
      notebooks={notebooks}
      isActive={!view && note.id === activeNoteId}
      href={noteHref(note.id)}
    />
  );


  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteDialogNotebook, setNoteDialogNotebook] = useState<string | null>(null);
  const [notebookDialogOpen, setNotebookDialogOpen] = useState(false);

  const openNewNote = (notebookId: string | null) => {
    setNoteDialogNotebook(notebookId);
    if (notebookId) updateCollapsed((s) => s.delete(notebookId));
    setNoteDialogOpen(true);
  };

  // View links carry the open note (and AI panel state) so the note's editor stays selected underneath.
  const viewHref = (v: string) =>
    `/?view=${v}${activeNoteId ? `&noteId=${activeNoteId}` : ""}${isAiOpen ? "&aiOpen=true" : ""}`;
  const navItems = [
    { key: "dashboard", href: viewHref("dashboard"), label: "Dashboard", title: "Dashboard", Icon: LayoutDashboard, iconClass: "", active: view === "dashboard" },
    { key: "ai", href: viewHref("chats"), label: "AI Chats", title: "AI Chats", Icon: Sparkles, iconClass: "text-amber-400", active: view === "chats" },
    { key: "calendar", href: viewHref("calendar"), label: "Calendar", title: "Calendar", Icon: CalendarDays, iconClass: "", active: view === "calendar" },
  ];

  const favorites = notes.filter((n) => n.isFavorite);
  const unfiled = notes.filter((n) => !n.notebookId);

  return (
    <>
      <div role="search" className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              if (query) setQuery("");
              else e.currentTarget.blur();
            }
          }}
          placeholder="Search notes & notebooks"
          aria-label="Search notes and notebooks"
          title="Search (Ctrl+Shift+F)"
          className="w-full rounded-md border border-neutral-800 bg-neutral-900 py-1.5 pl-7 pr-7 text-xs text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-neutral-500 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              searchRef.current?.focus();
            }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-neutral-500 hover:text-neutral-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <nav aria-label="Primary" className="flex items-center gap-1 max-md:grid max-md:grid-cols-3 pointer-coarse:grid pointer-coarse:grid-cols-3">
        {navItems.map(({ key, href, label, title, Icon, iconClass, active }) => (
          <Link
            key={key}
            href={href}
            aria-label={label}
            title={title}
            aria-current={active ? "page" : undefined}
            className={`group/nav flex h-8 min-w-0 items-center justify-center rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400 max-md:h-auto max-md:flex-col max-md:gap-0.5 max-md:py-1.5 pointer-coarse:h-auto pointer-coarse:flex-col pointer-coarse:gap-0.5 pointer-coarse:py-1.5 ${
              active ? "bg-neutral-800 text-neutral-100" : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
            }`}
          >
            <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} />
            {/* Collapsed to zero width until hover/focus on pointer devices, except the active view, which stays open; always visible under the icon on touch/narrow screens. */}
            <span
              aria-hidden
              className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-200 ease-out group-hover/nav:ml-2 group-hover/nav:max-w-24 group-hover/nav:opacity-100 group-focus-visible/nav:ml-2 group-focus-visible/nav:max-w-24 group-focus-visible/nav:opacity-100 max-md:ml-0 max-md:max-w-full max-md:text-[10px] max-md:opacity-100 pointer-coarse:ml-0 pointer-coarse:max-w-full pointer-coarse:text-[10px] pointer-coarse:opacity-100 motion-reduce:transition-none ${active ? "ml-2 max-w-24 opacity-100" : "max-w-0 opacity-0"}`}
            >
              {label}
            </span>
          </Link>
        ))}
      </nav>

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => openNewNote(null)}
          className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900 px-2 text-xs font-medium text-neutral-100 transition-colors hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400"
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">New note</span>
        </button>
        <button
          type="button"
          onClick={() => setNotebookDialogOpen(true)}
          className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border border-neutral-800 px-2 text-xs font-medium text-neutral-400 transition-colors hover:bg-neutral-900 hover:text-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400"
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Notebook</span>
        </button>
      </div>

      <NewNoteDialog
        open={noteDialogOpen}
        onOpenChange={setNoteDialogOpen}
        userId={userId}
        notebooks={notebooks}
        defaultNotebookId={noteDialogNotebook}
      />
      <NewNotebookDialog open={notebookDialogOpen} onOpenChange={setNotebookDialogOpen} userId={userId} />

      {q ? (
        <div className="flex flex-col gap-4" aria-live="polite">
          {matchedNotebooks.length === 0 && matchedNotes.length === 0 && (
            <p className="px-1 text-xs leading-5 text-neutral-500">
              No notes or notebooks match “{query.trim()}”.
            </p>
          )}
          {matchedNotebooks.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className={`${sectionLabel} mb-1`}>Notebooks</span>
              {matchedNotebooks.map((nb) => (
                <button
                  key={nb.id}
                  type="button"
                  onClick={() => {
                    // Reveal the notebook's contents in the normal view.
                    updateCollapsed((s) => s.delete(nb.id));
                    setQuery("");
                    requestAnimationFrame(() =>
                      document.getElementById(`notebook-${nb.id}`)?.scrollIntoView({ block: "nearest" })
                    );
                  }}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-neutral-300 hover:bg-neutral-900 hover:text-neutral-100"
                >
                  <Folder className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{nb.title}</span>
                  <span className="text-[10px] text-neutral-500">{notes.filter((n) => n.notebookId === nb.id).length}</span>
                </button>
              ))}
            </div>
          )}
          {matchedNotes.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className={`${sectionLabel} mb-1`}>Notes</span>
              {matchedNotes.map((n) => (
                <Link
                  key={n.id}
                  href={noteHref(n.id)}
                  onClick={() => setQuery("")}
                  className={`flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-neutral-900 hover:text-neutral-100 ${
                    n.id === activeNoteId && !view ? "bg-neutral-800 text-neutral-100" : "text-neutral-400"
                  }`}
                >
                  <DynamicIcon name={n.icon || "FileText"} color={n.iconColor || "#10b981"} className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{n.title || "Untitled"}</span>
                  {n.notebookId && (
                    <span className="max-w-[40%] truncate text-[10px] text-neutral-500">{notebookName.get(n.notebookId)}</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4" aria-label="Notes">
          {favorites.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className={`${sectionLabel} mb-1 flex items-center gap-1`}>
                <Star className="h-3 w-3" /> Favorites
              </span>
              {favorites.map(row)}
            </div>
          )}

          {notebooks.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <span className={`${sectionLabel} mb-1`}>Notebooks</span>
            {notebooks.map((nb) => (
              <NotebookSection
                key={nb.id}
                notebook={nb}
                onNewNote={openNewNote}
                notes={notes.filter((n) => n.notebookId === nb.id)}
                expanded={!collapsed.has(nb.id)}
                onToggle={() => updateCollapsed((s) => (s.has(nb.id) ? s.delete(nb.id) : s.add(nb.id)))}
                renderRow={row}
              />
            ))}
          </div>
          )}

          <div className="flex flex-col gap-0.5">
            <span className={`${sectionLabel} mb-1`}>Notes</span>
            {unfiled.length === 0 ? (
              <p className="px-1 text-xs leading-5 text-neutral-500">No notes yet. Use “New note” to start.</p>
            ) : (
              unfiled.map(row)
            )}
          </div>
        </div>
      )}
    </>
  );
}

function NoteRow({
  note,
  notebooks,
  isActive,
  href,
}: {
  note: NoteSummary;
  notebooks: Notebook[];
  isActive: boolean;
  href: string;
}) {
  return (
    <div
      className={`group flex items-center justify-between gap-1 rounded-md px-2 py-1.5 transition-colors ${
        isActive ? "bg-neutral-800 text-neutral-100" : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
      }`}
    >
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-2 text-xs" aria-current={isActive ? "page" : undefined}>
        <DynamicIcon name={note.icon || "FileText"} color={note.iconColor || "#10b981"} className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{note.title || "Untitled"}</span>
      </Link>
      <NoteActionMenu note={note} notebooks={notebooks} isActive={isActive} />
    </div>
  );
}

function NotebookSection({
  notebook,
  onNewNote,
  notes,
  expanded,
  onToggle,
  renderRow,
}: {
  notebook: Notebook;
  onNewNote: (notebookId: string) => void;
  notes: NoteSummary[];
  expanded: boolean;
  onToggle: () => void;
  renderRow: (note: NoteSummary) => React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(notebook.title);
  const [isPending, startTransition] = useTransition();
  const item = "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-neutral-800 disabled:opacity-50";

  const submitRename = () => {
    const next = name.trim();
    setRenaming(false);
    if (!next || next === notebook.title) {
      setName(notebook.title);
      return;
    }
    startTransition(async () => {
      await renameNotebook(notebook.id, next);
    });
  };

  const FolderIcon = expanded ? FolderOpen : Folder;

  return (
    <div id={`notebook-${notebook.id}`} className="flex flex-col gap-0.5">
      <div className="group flex items-center gap-1 rounded-md px-1 text-neutral-400 hover:bg-neutral-900">
        {renaming ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitRename();
            }}
            className="flex min-w-0 flex-1 py-1"
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={submitRename}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setName(notebook.title);
                  setRenaming(false);
                }
              }}
              aria-label="Notebook name"
              className="w-full min-w-0 rounded border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-xs text-neutral-100 outline-none focus:border-neutral-500"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400"
          >
            <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
            <FolderIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{notebook.title}</span>
            <span className="ml-auto pl-1 text-[10px] font-normal text-neutral-500">{notes.length}</span>
          </button>
        )}
        <FloatingPopover
          open={menuOpen}
          onOpenChange={setMenuOpen}
          triggerLabel={`Actions for notebook ${notebook.title}`}
          triggerClassName={`rounded p-1 text-neutral-400 transition-opacity hover:bg-neutral-800 hover:text-neutral-100 focus-visible:opacity-100 group-hover:opacity-100 ${menuOpen ? "opacity-100" : "opacity-0"}`}
          trigger={<MoreHorizontal className="h-3.5 w-3.5" />}
          align="end"
          className="w-48 py-1"
        >
          <button
            className={item}
            disabled={isPending}
            onClick={() => {
              setMenuOpen(false);
              onNewNote(notebook.id);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            New note here
          </button>
          <button
            className={item}
            onClick={() => {
              setMenuOpen(false);
              setName(notebook.title);
              setRenaming(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Rename
          </button>
          <div className="my-1 border-t border-neutral-800" />
          <button
            className={`${item} text-red-400`}
            onClick={() => {
              setMenuOpen(false);
              const count = notes.length;
              const msg = count
                ? `Delete the notebook “${notebook.title}”? Its ${count} note${count === 1 ? "" : "s"} will not be deleted; ${count === 1 ? "it moves" : "they move"} to Notes.`
                : `Delete the empty notebook “${notebook.title}”?`;
              if (confirm(msg)) {
                startTransition(async () => {
                  await deleteNotebook(notebook.id);
                });
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete notebook
          </button>
        </FloatingPopover>
      </div>
      {expanded && (
        <div className="ml-3 flex flex-col gap-0.5 border-l border-neutral-800 pl-2">
          {notes.length === 0 ? (
            <p className="px-2 py-1 text-[11px] text-neutral-500">Empty. Move a note here or use “New note here”.</p>
          ) : (
            notes.map(renderRow)
          )}
        </div>
      )}
    </div>
  );
}
