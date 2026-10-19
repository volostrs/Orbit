"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Copy, Download, Folder, Star, Trash2 } from "lucide-react";
import { DynamicIcon } from "@/components/DynamicIcon";
import { useToast } from "@/components/ui/toast";
import { deleteNote, duplicateNote, toggleFavoriteNote } from "@/lib/actions/notes";
import { exportNoteMarkdown } from "@/lib/actions/export";
import type { DashData, DashNote } from "./Widgets";

type Filter = "all" | "favorites" | "unfiled" | { notebook: string };

// "18 Oct", or "18 Oct 2025" when it isn't this year. Always the note's creation date.
function createdLabel(d: Date | string) {
  const date = new Date(d);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

const chip = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400";
// Card action icons: revealed on hover/keyboard focus with a mouse, always shown on touch and narrow screens.
const iconBtn =
  "rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400 disabled:opacity-50";

export function NotesGrid({ data }: { data: DashData }) {
  const { notes, notebooks } = data;
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const notebookName = useMemo(() => new Map(notebooks.map((nb) => [nb.id, nb.title])), [notebooks]);
  // A deleted notebook can leave a stale filter selected; fall back to All Notes.
  const active: Filter = typeof filter === "object" && !notebookName.has(filter.notebook) ? "all" : filter;

  const counts = useMemo(() => {
    const byNb = new Map<string, number>();
    let favorites = 0;
    let unfiled = 0;
    for (const n of notes) {
      if (n.isFavorite) favorites++;
      if (n.notebookId) byNb.set(n.notebookId, (byNb.get(n.notebookId) ?? 0) + 1);
      else unfiled++;
    }
    return { byNb, favorites, unfiled };
  }, [notes]);

  const shown = notes.filter((n) => {
    if (active === "all") return true;
    if (active === "favorites") return n.isFavorite;
    if (active === "unfiled") return !n.notebookId;
    return n.notebookId === active.notebook;
  });

  const select = (f: Filter) => setFilter(f);
  const isOn = (f: Filter) => JSON.stringify(f) === JSON.stringify(active);

  const run = (fn: () => Promise<unknown>, ok?: string) =>
    startTransition(async () => {
      try {
        await fn();
        if (ok) toast(ok);
      } catch {
        toast("Something went wrong. Please try again.");
      }
    });

  const onExport = (n: DashNote) =>
    run(async () => {
      const out = await exportNoteMarkdown(n.id);
      if (!out) throw new Error("missing");
      const url = URL.createObjectURL(new Blob([out.markdown], { type: "text/markdown;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = out.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "Exported as Markdown");

  const filterBtn = (f: Filter, label: string, count: number, icon?: React.ReactNode) => (
    <button
      key={typeof f === "object" ? f.notebook : f}
      type="button"
      aria-pressed={isOn(f)}
      onClick={() => select(f)}
      className={`${chip} ${isOn(f) ? "border-neutral-300 bg-neutral-800 text-neutral-100" : "border-neutral-800 text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"}`}
    >
      {icon}
      <span className="max-w-40 truncate">{label}</span>
      <span className="text-[11px] text-neutral-500">{count}</span>
    </button>
  );

  return (
    <div className="@container">
      <div role="group" aria-label="Filter notes" className="mb-3 flex flex-wrap items-center gap-1.5">
        {filterBtn("all", "All Notes", notes.length)}
        {filterBtn("favorites", "Favorites", counts.favorites, <Star className="h-3 w-3" />)}
        {notebooks.map((nb) => filterBtn({ notebook: nb.id }, nb.title, counts.byNb.get(nb.id) ?? 0, <Folder className="h-3 w-3" />))}
        {counts.unfiled > 0 && notebooks.length > 0 && filterBtn("unfiled", "Unfiled", counts.unfiled)}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-700 p-6 text-center text-sm text-neutral-500">
          {notes.length === 0
            ? "No notes yet. Use New Note to create your first one."
            : active === "favorites"
              ? "No favorites yet. Star a note to see it here."
              : "No notes here yet."}
        </p>
      ) : (
        <ul data-notes-grid className="grid grid-cols-1 gap-3 @md:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-4">
          {shown.map((n) => {
            const title = n.title?.trim() || "Untitled";
            const nbName = n.notebookId ? notebookName.get(n.notebookId) : undefined;
            return (
              <li
                key={n.id}
                data-note-card={n.id}
                className="group relative flex h-48 min-w-0 flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/50 p-3.5 transition-colors focus-within:border-neutral-500 hover:border-neutral-600 hover:bg-neutral-900"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-neutral-500">
                  <time dateTime={new Date(n.createdAt).toISOString()} title="Created">{createdLabel(n.createdAt)}</time>
                  {n.isFavorite && <Star className="h-3.5 w-3.5 fill-current text-amber-400" aria-label="Favorite" />}
                </div>
                <h3 className="mt-2 flex min-w-0 items-start gap-2 text-sm font-semibold leading-5 text-neutral-100">
                  <DynamicIcon name={n.icon || "FileText"} color={n.iconColor || "#10b981"} className="mt-0.5 h-4 w-4 shrink-0" />
                  <Link
                    href={`/?noteId=${n.id}`}
                    className="line-clamp-2 break-words after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                  >
                    {title}
                  </Link>
                </h3>
                <p className={`mt-1.5 line-clamp-4 break-words text-xs leading-5 ${n.preview ? "text-neutral-400" : "italic text-neutral-600"}`}>
                  {n.preview || "No content yet"}
                </p>
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  <span className="flex min-w-0 items-center gap-1 text-[11px] text-neutral-500">
                    {nbName && (
                      <>
                        <Folder className="h-3 w-3 shrink-0" />
                        <span className="truncate">{nbName}</span>
                      </>
                    )}
                  </span>
                  <div className="relative z-10 flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100 pointer-coarse:opacity-100">
                    <button type="button" disabled={pending} aria-pressed={n.isFavorite} aria-label={n.isFavorite ? `Remove ${title} from favorites` : `Add ${title} to favorites`} title={n.isFavorite ? "Remove from favorites" : "Add to favorites"} className={iconBtn} onClick={() => run(() => toggleFavoriteNote(n.id, n.isFavorite))}>
                      <Star className={`h-3.5 w-3.5 ${n.isFavorite ? "fill-current text-amber-400" : ""}`} />
                    </button>
                    <button type="button" disabled={pending} aria-label={`Duplicate ${title}`} title="Duplicate" className={iconBtn} onClick={() => run(() => duplicateNote(n.id), "Note duplicated")}>
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" disabled={pending} aria-label={`Export ${title} as Markdown`} title="Export as Markdown" className={iconBtn} onClick={() => onExport(n)}>
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      aria-label={`Delete ${title}`}
                      title="Delete"
                      className={`${iconBtn} hover:text-red-400`}
                      onClick={() => {
                        if (confirm(`Delete “${title}”? Its AI chats are deleted with it. This can't be undone.`)) run(() => deleteNote(n.id), "Note deleted");
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
