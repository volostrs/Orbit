import { getNotes } from "@/lib/actions/notes";
import { getNotebooks } from "@/lib/actions/notebooks";
import { NewNoteButton } from "@/components/NewNoteButton";
import {
  NewNotebookDialog,
  DeleteNotebookButton,
} from "@/components/NewNotebookDialog";
import { NoteActionMenu } from "@/components/NoteActionMenu";
import { DynamicIcon } from "@/components/DynamicIcon";
import { AiSidebarToggle } from "@/components/AiSidebarToggle";
import { NavShell } from "@/components/NavShell";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { NoteWorkspace } from "@/components/NoteWorkspace";
import { Folder } from "lucide-react";
import Link from "next/link";
import type { Note, Notebook } from "@/lib/db/schema";

const sectionLabel = "px-1 text-[11px] font-medium uppercase tracking-wider text-neutral-500";

function NoteRow({
  note,
  notebooks,
  isActive,
  isAiOpen,
}: {
  note: Note;
  notebooks: Notebook[];
  isActive: boolean;
  isAiOpen: boolean;
}) {
  return (
    <div
      className={`group flex items-center justify-between gap-1 rounded-md px-2 py-1.5 transition-colors ${
        isActive ? "bg-neutral-800 text-neutral-100" : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
      }`}
    >
      <Link
        href={`/?noteId=${note.id}${isAiOpen ? "&aiOpen=true" : ""}`}
        className="flex min-w-0 flex-1 items-center gap-2 text-xs"
        aria-current={isActive ? "page" : undefined}
      >
        <DynamicIcon
          name={note.icon || "FileText"}
          color={note.iconColor || "#10b981"}
          className="h-3.5 w-3.5 shrink-0"
        />
        <span className="truncate">{note.title || "Untitled"}</span>
      </Link>
      <NoteActionMenu note={note} notebooks={notebooks} isActive={isActive} />
    </div>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ noteId?: string; aiOpen?: string }>;
}) {
  const testUserId = "user_demo_123";
  const notes = await getNotes(testUserId);
  const notebooks = await getNotebooks(testUserId);
  const { noteId, aiOpen } = await searchParams;

  const activeNote = notes.find((n) => n.id === noteId) || notes[0];
  const isAiOpen = aiOpen === "true";

  const favoriteNotes = notes.filter((n) => n.isFavorite);
  const uncategorizedNotes = notes.filter((n) => !n.notebookId);

  const row = (note: Note) => (
    <NoteRow key={note.id} note={note} notebooks={notebooks} isActive={note.id === activeNote?.id} isAiOpen={isAiOpen} />
  );

  return (
    <main className="flex h-dvh w-screen overflow-hidden bg-black font-sans text-neutral-100 antialiased">
      {/* Navigation Sidebar */}
      <NavShell>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
          <div className="flex items-center justify-between">
            <h1 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Orbit</h1>
            <NewNotebookDialog userId={testUserId} />
          </div>

          <NewNoteButton userId={testUserId} />

          <nav className="mt-1 flex flex-col gap-4" aria-label="Notes">
            {notes.length === 0 && notebooks.length === 0 && (
              <p className="px-1 text-xs leading-5 text-neutral-500">
                No notes yet. Create one to get started.
              </p>
            )}

            {favoriteNotes.length > 0 && (
              <div className="flex flex-col gap-0.5">
                <span className={`${sectionLabel} mb-1`}>Favorites</span>
                {favoriteNotes.map(row)}
              </div>
            )}

            {notebooks.map((notebook) => (
              <div key={notebook.id} className="flex flex-col gap-0.5">
                <div className="group mb-1 flex items-center justify-between gap-2 px-1 text-neutral-400">
                  <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
                    <Folder className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{notebook.title}</span>
                  </span>
                  <DeleteNotebookButton notebookId={notebook.id} />
                </div>
                <div className="flex flex-col gap-0.5 border-l border-neutral-800 pl-2">
                  {notes.filter((n) => n.notebookId === notebook.id).map(row)}
                </div>
              </div>
            ))}

            {uncategorizedNotes.length > 0 && (
              <div className="flex flex-col gap-0.5">
                <span className={`${sectionLabel} mb-1`}>Notes</span>
                {uncategorizedNotes.map(row)}
              </div>
            )}
          </nav>
        </div>

        <div className="flex flex-col gap-2 border-t border-neutral-800 pt-3">
          <AiSidebarToggle isAiOpen={isAiOpen} activeNoteId={activeNote?.id} />
          <ThemeSwitch />
        </div>
      </NavShell>

      {/* Workspace Client Wrapper (Editor + AI Sidebar with change review) */}
      <NoteWorkspace
        initialNote={activeNote}
        notebooks={notebooks}
        isAiOpen={isAiOpen}
      />
    </main>
  );
}
